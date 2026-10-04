import { useState } from "react";
import { Lock } from "lucide-react";
import { useAdminSession } from "@/lib/adminSession";

export default function LoginPage() {
  const { login, sessionMessage } = useAdminSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await login(username.trim().toLowerCase(), password.trim());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Usuário ou senha incorretos.");
    } finally {
      setPending(false);
    }
  }

  const message = error || sessionMessage;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#fbfbfd] px-4 py-12">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-3xl border border-[#e5e5e7] bg-white p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07)] sm:p-10"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d1d1f] text-white shadow-md">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-center font-display text-2xl font-bold tracking-tight text-[#1d1d1f] sm:text-3xl">
          Painel da Loja
        </h1>
        <p className="mt-1.5 text-center text-sm text-[#86868b]">
          Área de administração restrita da Lojinha do Celular.
        </p>

        <label className="mt-6 block">
          <span className="mb-2 block text-xs font-semibold tracking-wide text-[#6e6e73]">Usuário</span>
          <div className="flex h-12 items-center rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 transition-all duration-200 focus-within:border-[#0071e3] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0071e3]/15">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex.: dono"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              className="w-full border-none bg-transparent text-[15px] text-[#1d1d1f] shadow-none outline-none ring-0 placeholder:text-[#86868b] focus:outline-none focus:ring-0"
            />
          </div>
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-semibold tracking-wide text-[#6e6e73]">Senha</span>
          <div className="flex h-12 items-center rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 transition-all duration-200 focus-within:border-[#0071e3] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0071e3]/15">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              className="w-full border-none bg-transparent text-[15px] text-[#1d1d1f] shadow-none outline-none ring-0 placeholder:text-[#86868b] focus:outline-none focus:ring-0"
            />
          </div>
        </label>

        {message && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !password || !username.trim()}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#1d1d1f] font-display font-semibold text-white shadow-[0_10px_25px_-10px_rgba(0,0,0,0.3)] transition-all hover:bg-black active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "Entrando..." : "Acessar Painel"}
        </button>
      </form>
    </div>
  );
}
