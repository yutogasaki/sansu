"""Float64 authored field and source-normal transport; no Blender import or asset IO."""
from fractions import Fraction as F
import math
import struct


def f32(value):
    return struct.unpack('<f',struct.pack('<f',value))[0]


def transpose(matrix):
    return [list(row) for row in zip(*matrix)]


def multiply(a,b):
    return [[sum(x*y for x,y in zip(row,column)) for column in zip(*b)] for row in a]


def vector(matrix, value):
    return [sum(x*y for x,y in zip(row,value)) for row in matrix]


def point(matrix, value):
    return vector(matrix,list(value)+[1.])[:3]


def inverse(matrix):
    n=len(matrix)
    rows=[[F(x) for x in row]+[F(int(i==j)) for j in range(n)] for i,row in enumerate(matrix)]
    for k in range(n):
        pivot=next(i for i in range(k,n) if rows[i][k])
        rows[k],rows[pivot]=rows[pivot],rows[k]
        d=rows[k][k]
        rows[k]=[x/d for x in rows[k]]
        for i in range(n):
            if i!=k:
                d=rows[i][k]
                rows[i]=[x-d*y for x,y in zip(rows[i],rows[k])]
    return [[float(x) for x in row[n:]] for row in rows]


def determinant(a):
    return a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])-a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])+a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0])


def normalize(value):
    length=math.sqrt(sum(x*x for x in value))
    assert length>0 and math.isfinite(length)
    return [x/length for x in value]


def cross(a,b):
    return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]


def exact_zero_faces(positions,faces):
    result=[]
    for i,indices in enumerate(faces):
        a,b,c=[[F(x) for x in positions[index]] for index in indices]
        u=[y-x for x,y in zip(a,b)];v=[y-x for x,y in zip(a,c)]
        if cross(u,v)==[0,0,0]:result.append(i)
    return result


def profile(positions,normals,transform,field,tip_vertex=37):
    affine=[row[:3] for row in transform[:3]]
    normal_world=transpose(inverse(affine))
    normal_local=transpose(affine)
    inv=inverse(transform)
    world=[point(transform,p) for p in positions]
    targets=[list(field(tuple(p))) for p in world]
    local=[point(inv,p) for p in targets]
    center=local[tip_vertex]
    desired=[];jacobians=[];transports=[]
    epsilon=1e-5
    for p,n in zip(world,normals):
        columns=[]
        for axis in range(3):
            lo=list(p);hi=list(p);lo[axis]-=epsilon;hi[axis]+=epsilon
            a,b=field(tuple(lo)),field(tuple(hi))
            columns.append([(y-x)/(2*epsilon) for x,y in zip(a,b)])
        j=transpose(columns)
        assert determinant(j)>=.2,'Original sampled determinant guard unchanged'
        transport=multiply(multiply(normal_local,transpose(inverse(j))),normal_world)
        desired.append(normalize(vector(transport,n)))
        jacobians.append(j);transports.append(transport)
    translation=[[float(i==j) for j in range(4)] for i in range(4)]
    for i in range(3):translation[i][3]=center[i]
    return {'world64':world,'targets64':targets,'local64':local,'center64':center,
            'oldPivot32':[[f32(x) for x in p] for p in local],
            'tipRelative32':[[f32(x-c) for x,c in zip(p,center)] for p in local],
            'compensatedTransform64':multiply(transform,translation),
            'desiredNormalsByVertex64':desired,'jacobians64':jacobians,'normalTransports64':transports,
            'minimumJacobianDeterminant':min(determinant(j) for j in jacobians),
            'finiteDifferenceEpsilonUnchanged':epsilon,
            'precisionDifference':'Float64 points/field/J/inverse until final mesh cast; same authored field, no mathutils intermediate Vector.'}
