"""Complete ordered sharp-edge fingerprint, with bounded temporary memory."""
import hashlib
import struct


def edge_fingerprint(edges):
    digest=hashlib.sha256()
    count=0
    for indices,flag in edges:
        assert len(indices)==2
        digest.update(struct.pack('<2I?',*indices,bool(flag)))
        count+=1
    return {'count':count,'orderedEdgeIndicesAndFlagsSHA256':digest.hexdigest(),
            'encoding':'every edge in order: little-endian uint32,uint32,bool; no omissions'}
