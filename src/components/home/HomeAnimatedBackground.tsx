import { motion } from "framer-motion";

export const HomeAnimatedBackground: React.FC = () => {
    return (
        <>
            <motion.div
                animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, rgba(240,253,250,0.92) 40%, rgba(224,242,254,0.95) 100%)",
                    backgroundSize: "200% 200%",
                }}
            />

            <motion.div
                animate={{ y: [0, -24, 0], x: [0, 14, 0], opacity: [0.24, 0.48, 0.24] }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-[10%] top-[8%] h-64 w-64 rounded-full blur-3xl"
                style={{
                    background:
                        "radial-gradient(circle, rgba(167,243,208,0.46) 0%, rgba(167,243,208,0.14) 45%, transparent 72%)",
                }}
            />

            <motion.div
                animate={{ y: [0, 26, 0], x: [0, -18, 0], opacity: [0.18, 0.42, 0.18] }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                className="absolute bottom-[14%] right-[8%] h-56 w-56 rounded-full blur-3xl"
                style={{
                    background:
                        "radial-gradient(circle, rgba(125,211,252,0.48) 0%, rgba(125,211,252,0.14) 45%, transparent 72%)",
                }}
            />

            <motion.div
                animate={{ y: [0, -16, 0], x: [0, -10, 0], opacity: [0.12, 0.28, 0.12] }}
                transition={{ duration: 17, repeat: Infinity, ease: "easeInOut", delay: 2.4 }}
                className="absolute bottom-[26%] left-[22%] h-40 w-40 rounded-full blur-[52px]"
                style={{
                    background:
                        "radial-gradient(circle, rgba(253,224,71,0.42) 0%, rgba(253,224,71,0.12) 44%, transparent 72%)",
                }}
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.36),transparent_24%),radial-gradient(circle_at_78%_26%,rgba(255,255,255,0.2),transparent_18%),radial-gradient(circle_at_62%_76%,rgba(255,255,255,0.18),transparent_20%)]" />
        </>
    );
};
