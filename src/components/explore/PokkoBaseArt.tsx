import { cn } from "../../utils/cn";

interface PokkoBaseArtProps {
    decorative?: boolean;
    className?: string;
}

/**
 * The base reuses the approved painterly fork scene so Pokko does not switch
 * into a second, flat illustration language after returning from a run.
 */
export const PokkoBaseArt = ({
    decorative = false,
    className,
}: PokkoBaseArtProps) => (
    <figure
        className={cn("pokko-base-art", className)}
        data-testid="pokko-base-art"
        data-character-id="pokko"
        data-visual-lineage-id="pokko-field-v1"
        data-visual-candidate-id="pokko-base-painted-v1"
        data-visual-mode="base-map"
        aria-hidden={decorative || undefined}
    >
        <img
            src="/assets/explore/route-choice/scene-fork-two-pokko-v1.jpg"
            alt={decorative
                ? ""
                : "葉帽子のポッコが、明るい地底の分かれ道で次の行き先を見つめている。"}
            draggable={false}
            decoding="async"
        />
    </figure>
);
