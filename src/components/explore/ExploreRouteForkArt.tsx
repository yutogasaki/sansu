interface ExploreRouteForkArtProps {
    branchCount: 2 | 3;
}

const ROUTE_FORK_ASSETS: Record<2 | 3, string> = {
    2: "/assets/explore/route-choice/scene-fork-two-pokko-v1.jpg",
    3: "/assets/explore/route-choice/scene-fork-three-pokko-v1.jpg",
};

// A valid decoded 1x1 fallback keeps phones out of the tablet artwork while
// still satisfying the runtime image-integrity gate.
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export const ExploreRouteForkArt = ({
    branchCount,
}: ExploreRouteForkArtProps) => (
    <picture
        aria-hidden="true"
        className="explore-route-fork-art-frame"
        data-branch-count={branchCount}
        data-testid="explore-route-fork-art"
    >
        <source
            media="(min-width: 600px) and (orientation: portrait) and (min-height: 760px)"
            srcSet={ROUTE_FORK_ASSETS[branchCount]}
        />
        <img
            alt=""
            className="explore-route-fork-art"
            decoding="async"
            draggable={false}
            fetchPriority="high"
            src={TRANSPARENT_PIXEL}
        />
    </picture>
);
