"""Saved parent/local Float32 composition contract for the diagnostic clone."""
import geometry as g


def multiply32(a,b):
    return [[g.f32(sum(g.f32(x*y) for x,y in zip(row,col))) for col in zip(*b)] for row in a]


def parent_product32(parent,inverse,basis):
    if parent is None:return basis
    return multiply32(parent,multiply32(inverse,basis))
