"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
  artistName: string;
  trackName: string;
  genre: string;
  releaseDate: string;
  explicit: boolean;
};

type ReleaseFormProps = {
  onSubmitted: () => void;
};

export function ReleaseForm({ onSubmitted }: ReleaseFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    defaultValues: {
      artistName: "",
      trackName: "",
      genre: "",
      releaseDate: "",
      explicit: false
    }
  });

  const values = watch();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onSubmitted();
    }, 800);
  };

  return (
    <div
      style={{
        backgroundColor: "#080808",
        minHeight: "100vh",
        padding: "20px"
      }}
    >
      <div style={{ maxWidth: "440px", margin: "0 auto", color: "#FFFFFF" }}>
        <header style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              letterSpacing: "-0.8px",
              margin: 0
            }}
          >
            New Release
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "#8E8E93",
              marginTop: "4px"
            }}
          >
            Создай профессиональный пак для дистрибуции
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Card 1 */}
          <div
            style={{
              backgroundColor: "#141416",
              borderRadius: "24px",
              padding: "24px",
              marginBottom: "16px",
              border: "1px solid rgba(255,255,255,0.05)"
            }}
          >
            <div style={{ marginBottom: "18px" }}>
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#8E8E93",
                  marginBottom: "8px",
                  display: "block"
                }}
              >
                Artist Name
              </label>
              <input
                {...register("artistName", { required: "Укажите имя артиста" })}
                placeholder="Имя артиста"
                style={{
                  backgroundColor: "#1d1d20",
                  border: "1px solid transparent",
                  borderRadius: "16px",
                  padding: "14px 18px",
                  width: "100%",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  outline: "none"
                }}
              />
              {errors.artistName && (
                <p
                  style={{
                    color: "#fca5a5",
                    fontSize: "11px",
                    marginTop: "4px"
                  }}
                >
                  {errors.artistName.message}
                </p>
              )}
            </div>

            <div>
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#8E8E93",
                  marginBottom: "8px",
                  display: "block"
                }}
              >
                Track Title
              </label>
              <input
                {...register("trackName", {
                  required: "Укажите название трека"
                })}
                placeholder="Название трека"
                style={{
                  backgroundColor: "#1d1d20",
                  border: "1px solid transparent",
                  borderRadius: "16px",
                  padding: "14px 18px",
                  width: "100%",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  outline: "none"
                }}
              />
              {errors.trackName && (
                <p
                  style={{
                    color: "#fca5a5",
                    fontSize: "11px",
                    marginTop: "4px"
                  }}
                >
                  {errors.trackName.message}
                </p>
              )}
            </div>
          </div>

          {/* Card 2 */}
          <div
            style={{
              backgroundColor: "#141416",
              borderRadius: "24px",
              padding: "24px",
              marginBottom: "16px",
              border: "1px solid rgba(255,255,255,0.05)"
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginBottom: "18px"
              }}
            >
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#8E8E93",
                    marginBottom: "8px",
                    display: "block"
                  }}
                >
                  Genre
                </label>
                <input
                  {...register("genre")}
                  placeholder="Pop"
                  style={{
                    backgroundColor: "#1d1d20",
                    border: "1px solid transparent",
                    borderRadius: "16px",
                    padding: "14px 18px",
                    width: "100%",
                    color: "#FFFFFF",
                    fontSize: "16px",
                    outline: "none"
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#8E8E93",
                    marginBottom: "8px",
                    display: "block"
                  }}
                >
                  Date
                </label>
                <input
                  type="date"
                  {...register("releaseDate")}
                  style={{
                    backgroundColor: "#1d1d20",
                    border: "1px solid transparent",
                    borderRadius: "16px",
                    padding: "14px 18px",
                    width: "100%",
                    color: "#FFFFFF",
                    fontSize: "16px",
                    outline: "none"
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "4px"
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 500
                }}
              >
                Explicit Content
              </span>
              <input
                type="checkbox"
                checked={values.explicit}
                onChange={(e) => setValue("explicit", e.target.checked)}
                style={{
                  width: 20,
                  height: 20,
                  accentColor: "#007AFF",
                  cursor: "pointer"
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "20px",
              borderRadius: "20px",
              background:
                "linear-gradient(135deg, #007AFF 0%, #0051FF 100%)",
              color: "white",
              fontSize: "17px",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(0,122,255,0.3)",
              opacity: submitting ? 0.85 : 1,
              transform: submitting ? "scale(0.99)" : "scale(1)",
              transition: "all 0.2s ease-out"
            }}
          >
            {submitting ? "Processing..." : "Generate Release Package"}
          </button>
        </form>
      </div>
    </div>
  );
}

