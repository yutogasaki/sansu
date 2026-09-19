/** Agent-hosted orchestration. The bridge supplies existing MCP tools and local I/O.
 * Never invokes a paid tool except once after a persisted reservation.
 * maxPolls bounds one invocation; call again with the SAME state to resume.
 */
export async function runBatch(bridge, { root, statePath, maxPolls = 1, allowGeneration = false }) {
  const cli = async (command, asset, payload) => {
    const args = ['python3', `${root}/tools/asset-pipeline/pipeline.py`, command, '--state', statePath];
    if (asset) args.push('--asset', asset);
    if (payload) args.push('--payload', payload);
    return JSON.parse(await bridge.command(args));
  };
  let state = await cli('show');
  for (const id of Object.keys(state.assets)) {
    let job = state.assets[id];
    const base = `${root}/assets/${id}`;
    if (job.status === 'READY') {
      if (!allowGeneration) continue; // Explicit opt-in only after budget/user approval.
      const balance = await bridge.call('meshy_check_balance', { response_format: 'json' });
      if (balance.balance < state.credits_per_asset) throw new Error('Insufficient balance; do not recharge');
      const request = await cli('reserve', id);
      // Intentionally NO retry around this call, even for connection errors.
      const receipt = await bridge.call(request.tool, request.arguments);
      if (!receipt.task_id) throw new Error('Submission uncertain; recover task ID, never resubmit');
      const path = `${base}/meshy_raw/submission.json`;
      await bridge.writeJson(path, { task_id: receipt.task_id, status: receipt.status });
      job = await cli('attach', id, path);
    }
    if (job.status === 'SUBMISSION_UNCERTAIN') throw new Error(`${id}: submission uncertain; recover task ID`);
    for (let poll = 0; ['SUBMITTED', 'IN_PROGRESS'].includes(job.status) && poll < maxPolls; poll++) {
      const result = await bridge.call('meshy_get_task_status', {
        task_id: job.task_id, task_type: 'image-to-3d', wait: true, timeout_seconds: 40, response_format: 'json',
      });
      const path = `${base}/meshy_raw/status.json`;
      const receipt = { task_id: result.task_id, status: result.status };
      if (result.consumed_credits !== undefined) receipt.consumed_credits = result.consumed_credits;
      await bridge.writeJson(path, receipt); // Excludes expiring signed URLs.
      job = await cli('result', id, path);
      await bridge.progress(`${id}: ${result.status} ${result.progress}%`);
    }
    if (['FAILED', 'CANCELED'].includes(job.status)) throw new Error(`${id}: ${job.status}; no regeneration`);
    if (job.status === 'SUCCEEDED') {
      const rawPath = `${base}/meshy_raw/model.glb`;
      // A download interrupted after file creation can be registered locally on resume.
      if (!(await bridge.exists(rawPath))) {
        await bridge.call('meshy_download_model', {
          task_id: job.task_id, task_type: 'image-to-3d', format: 'glb',
          save_to: rawPath, include_textures: true, print_ready: false,
        });
      }
      job = await cli('downloaded', id);
    }
    if (job.status === 'DOWNLOADED') {
      await bridge.blender(
        `import runpy\nrunpy.run_path(${JSON.stringify(`${root}/tools/asset-pipeline/blender_process.py`)})['process'](${JSON.stringify(statePath)}, ${JSON.stringify(id)})`,
      );
      job = await cli('verified', id);
      await bridge.progress(`${id}: verified ${job.final.triangles} triangles`);
    } else if (job.status === 'VERIFIED') {
      await cli('verified', id); // Read/check current bytes without paid calls or rendering.
    }
    state = await cli('show');
  }
  return state;
}
