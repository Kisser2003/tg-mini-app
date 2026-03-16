import { motion } from "framer-motion";

type Props = {
  onReset: () => void;
};

export function SuccessScreen({ onReset }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center space-y-4 py-6"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/40"
      >
        <span className="text-3xl">✓</span>
      </motion.div>
      <div>
        <h2 className="text-xl font-semibold">Релиз успешно отправлен</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Мы проверим данные и свяжемся с вами.
        </p>
      </div>
      <button
        onClick={onReset}
        className="mt-2 inline-flex items-center justify-center rounded-full bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
      >
        Отправить ещё релиз
      </button>
    </motion.div>
  );
}

