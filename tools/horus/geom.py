import math
def spiral(px,py,radii,theta0=0.0,cw=True):
    """tangent-continuous quarter-arc spiral. returns path d starting at (px,py)."""
    s=1 if cw else -1
    d="M%.2f %.2f"%(px,py); th=theta0
    x,y=px,py
    for r in radii:
        cx=x-r*math.cos(th); cy=y-r*math.sin(th)
        th2=th+s*math.pi/2
        x=cx+r*math.cos(th2); y=cy+r*math.sin(th2)
        d+=" A%.1f %.1f 0 0 %d %.2f %.2f"%(r,r,1 if cw else 0,x,y)
        th=th2
    return d
def star(cx,cy,R,k=0.2):
    # concave 4-point sparkle
    a=R; b=R*k
    return ("M%.2f %.2f C%.2f %.2f %.2f %.2f %.2f %.2f C%.2f %.2f %.2f %.2f %.2f %.2f "
            "C%.2f %.2f %.2f %.2f %.2f %.2f C%.2f %.2f %.2f %.2f %.2f %.2fZ")%(
        cx,cy-a, cx+b,cy-b*1.0*3, cx+b*3,cy-b, cx+a,cy,
        cx+b*3,cy+b, cx+b,cy+b*3, cx,cy+a,
        cx-b,cy+b*3, cx-b*3,cy+b, cx-a,cy,
        cx-b*3,cy-b, cx-b,cy-b*3, cx,cy-a)
if __name__=="__main__":
    print(spiral(170,130,[22,17,12,8,5],0,False))
    print(star(0,0,18))
