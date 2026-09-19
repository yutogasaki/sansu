/** Adapter for the Codex functions.exec tools object. No keys or raw HTTP needed. */
export function createCodexBridge(tools, { userPrompt, onProgress = async () => {} }) {
  const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
  const command = async args => {
    const result = await tools.exec_command({ cmd: args.map(quote).join(' '), max_output_tokens: 12000 });
    if (result.exit_code !== 0) throw new Error(result.output || 'Local command failed');
    return result.output;
  };
  return {
    command,
    async writeJson(path, value) {
      await command(['python3', '-c',
        "import sys,json;from pathlib import Path;p=Path(sys.argv[1]);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(json.loads(sys.argv[2]),indent=2)+'\\n')",
        path, JSON.stringify(value)]);
    },
    async exists(path) {
      return (await command(['python3', '-c', 'import sys;from pathlib import Path;print(Path(sys.argv[1]).exists())', path])).trim() === 'True';
    },
    async call(name, args) {
      const allowed = ['meshy_check_balance', 'meshy_image_to_3d', 'meshy_get_task_status', 'meshy_download_model'];
      if (!allowed.includes(name)) throw new Error(`Paid follow-up or unknown tool blocked: ${name}`);
      const result = await tools[`mcp__meshy_mcp_server__${name}`](args);
      if (!result.structuredContent) throw new Error('MCP result missing structuredContent; investigate without retrying submission');
      return result.structuredContent;
    },
    async blender(code) {
      const result = await tools.mcp__blender__execute_blender_code({ code, user_prompt: userPrompt });
      const message = result.structuredContent?.result;
      if (!message || message.startsWith('Error')) throw new Error(message || 'Blender result missing');
      return message;
    },
    progress: onProgress,
  };
}
