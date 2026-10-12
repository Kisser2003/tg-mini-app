import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Общая рамка экранов входа, регистрации и восстановления пароля. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="mx-auto flex min-h-app w-full max-w-md flex-col justify-center px-5 py-10 text-omf-ink">
      <p className="text-[15px] font-extrabold tracking-[-0.02em] text-omf-ultra-text">OMF Distribution</p>
      <h1 className="mt-3 text-[40px] font-extrabold leading-[0.95] tracking-[-0.045em]">{title}</h1>
      {subtitle ? <p className="mt-3 text-[15px] leading-relaxed text-omf-graphite">{subtitle}</p> : null}
      <div className="mt-8">{children}</div>
      {footer ? <div className="mt-6 text-[14px] text-omf-graphite">{footer}</div> : null}
    </div>
  );
}

/** Сообщение под формой: ошибка или успех. */
export function AuthMessage({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-control border px-4 py-3 text-[14px] leading-relaxed text-omf-ink ${
        kind === "error" ? "border-omf-red" : "border-omf-green"
      }`}
    >
      {children}
    </p>
  );
}
