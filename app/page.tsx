"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ReleaseForm } from "../components/ReleaseForm";
import { SuccessScreen } from "../components/SuccessScreen";
import {
  getTelegramUserDisplayName,
  initTelegramWebApp,
  isTelegramMiniApp
} from "@/lib/telegram";

export default function HomePage() {
  const [step, setStep] = useState<"welcome" | "form" | "success">("welcome");
  const [isTelegram, setIsTelegram] = useState(false);
  const [telegramName, setTelegramName] = useState<string | null>(null);

  useEffect(() => {
    const webApp = initTelegramWebApp();
    setIsTelegram(Boolean(webApp && isTelegramMiniApp()));
    setTelegramName(getTelegramUserDisplayName());
  }, []);

  const handleStart = () => setStep("form");
  const handleSubmitted = () => setStep("success");
  const handleReset = () => setStep("form");

  // Общие стили для текста
  const textMuted = { color: "#8E8E93", fontSize: "12px" };
  const textWhite = { color: "#FFFFFF" };

  return (
    <div
      style={{
        backgroundColor: "#080808",
        minHeight: "100vh",
        padding: "40px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      <div style={{ maxWidth: "440px", margin: "0 auto" }}>
        
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: "32px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ ...textMuted, textTransform: "uppercase", letterSpacing: "2px", fontSize: "10px", marginBottom: "4px" }}>
                Telegram Mini App
              </p>
              <h1 style={{ ...textWhite, fontSize: "28px", fontWeight: "800", margin: 0 }}>
                Release Assistant
              </h1>
            </div>
            <div style={{ 
              padding: "4px 10px", 
              borderRadius: "100px", 
              fontSize: "10px", 
              fontWeight: "bold",
              border: isTelegram ? "1px solid #007AFF" : "1px solid #f59e0b",
              color: isTelegram ? "#007AFF" : "#f59e0b",
              backgroundColor: isTelegram ? "rgba(0,122,255,0.1)" : "rgba(245,158,11,0.1)"
            }}>
              {isTelegram ? "TELEGRAM OK" : "BROWSER"}
            </div>
          </div>
          <p style={{ ...textMuted, marginTop: "12px", lineHeight: "1.5" }}>
            Загрузите трек и обложку — мы передадим релиз на дистрибуцию и свяжемся с вами.
          </p>
          {telegramName && (
            <p style={{ color: "#007AFF", fontSize: "12px", marginTop: "8px", fontWeight: "500" }}>
              Привет, {telegramName}!
            </p>
          )}
        </motion.div>

        {/* WELCOME STEP */}
        {step === "welcome" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: "center" }}
          >
            <div style={{ 
              backgroundColor: "#141416", 
              padding: "30px 20px", 
              borderRadius: "24px", 
              border: "1px solid rgba(255,255,255,0.05)",
              marginBottom: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>🚀</div>
              <h2 style={{ ...textWhite, fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
                Готовы к релизу?
              </h2>
              <p style={{ ...textMuted, fontSize: "14px" }}>
                Минимум полей — максимум скорости. <br/>Загрузка займет всего пару минут.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleStart}
              style={{
                width: "100%",
                padding: "20px",
                borderRadius: "20px",
                background: "linear-gradient(135deg, #007AFF 0%, #0051FF 100%)",
                color: "white",
                fontSize: "17px",
                fontWeight: "bold",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 10px 25px rgba(0,122,255,0.3)"
              }}
            >
              Начать загрузку
            </motion.button>
          </motion.div>
        )}

        {/* FORM STEP */}
        {step === "form" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ReleaseForm onSubmitted={handleSubmitted} />
          </motion.div>
        )}

        {/* SUCCESS STEP */}
        {step === "success" && (
          <div style={{ textAlign: "center", paddingTop: "40px" }}>
            <SuccessScreen onReset={handleReset} />
          </div>
        )}

      </div>
    </div>
  );
}