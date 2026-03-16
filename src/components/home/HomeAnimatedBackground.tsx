import { motion } from "framer-motion";

export const HomeAnimatedBackground: React.FC = () => {
    return (
        <>
            <motion.div
                animate={{
                    backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(circle at center, #ffffff 0%, #f0fdfa 40%, #e0f2fe 100%)",
                    backgroundSize: "200% 200%",
                    zIndex: 0,
                    opacity: 0.8,
                }}
            />

            <motion.div
                animate={{ y: [0, -20, 0], x: [0, 10, 0], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: "absolute",
                    top: "10%",
                    left: "15%",
                    width: 250,
                    height: 250,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(168, 230, 207, 0.3) 0%, transparent 70%)",
                    zIndex: 0,
                    filter: "blur(20px)",
                }}
            />

            <motion.div
                animate={{ y: [0, 30, 0], x: [0, -15, 0], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                style={{
                    position: "absolute",
                    bottom: "20%",
                    right: "10%",
                    width: 180,
                    height: 180,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(186, 230, 253, 0.4) 0%, transparent 70%)",
                    zIndex: 0,
                    filter: "blur(15px)",
                }}
            />
        </>
    );
};
