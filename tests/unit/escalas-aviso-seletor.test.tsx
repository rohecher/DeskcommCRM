import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SeletorDoNumero } from "@/app/app/escalas/avisos/SeletorDoNumero";

const SECRETARIA = { id: "11111111-1111-4111-8111-111111111111", nome: "Secretaria", telefone: "+5511900000001", conectado: true };
const ESCALA = { id: "22222222-2222-4222-8222-222222222222", nome: "Escala", telefone: "+5511900000002", conectado: true };
const PARADO = { id: "33333333-3333-4333-8333-333333333333", nome: null, telefone: null, conectado: false };

describe("a tela do número dos avisos", () => {
  it("sem nenhum número conectado, diz o que fazer e não oferece botão", () => {
    render(<SeletorDoNumero canais={[]} escolhido={null} aoSalvar={vi.fn()} />);

    expect(screen.getByText(/Nenhum número de WhatsApp conectado ainda/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar este número" })).not.toBeInTheDocument();
  });

  it("com números e nenhum escolhido, avisa que os avisos ainda não saem", () => {
    render(<SeletorDoNumero canais={[SECRETARIA, ESCALA]} escolhido={null} aoSalvar={vi.fn()} />);

    expect(screen.getByText(/ainda não escolheu um número, então os avisos da escala não saem/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Secretaria/ })).not.toBeChecked();
  });

  it("marca o número em uso e mostra quem está sem conexão", () => {
    render(<SeletorDoNumero canais={[SECRETARIA, PARADO]} escolhido={SECRETARIA.id} aoSalvar={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /Secretaria/ })).toBeChecked();
    expect(screen.getByText("Número em uso")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Número sem nome/ })).toBeInTheDocument();
    expect(screen.getByText("Sem conexão")).toBeInTheDocument();
  });

  it("escolher outro número e salvar chama a ação com o id e confirma", async () => {
    const aoSalvar = vi.fn(async () => ({ ok: true as const }));
    const user = userEvent.setup();
    render(<SeletorDoNumero canais={[SECRETARIA, ESCALA]} escolhido={SECRETARIA.id} aoSalvar={aoSalvar} />);

    await user.click(screen.getByRole("radio", { name: /Escala/ }));
    await user.click(screen.getByRole("button", { name: "Usar este número" }));

    expect(aoSalvar).toHaveBeenCalledWith(ESCALA.id);
    await waitFor(() => expect(screen.getByText("Pronto. Os avisos da escala saem por este número.")).toBeInTheDocument());
  });

  it("recusa de papel aparece em linguagem de gente, não como código", async () => {
    const aoSalvar = vi.fn(async () => ({ ok: false as const, erro: "forbidden_role" }));
    const user = userEvent.setup();
    render(<SeletorDoNumero canais={[SECRETARIA, ESCALA]} escolhido={null} aoSalvar={aoSalvar} />);

    await user.click(screen.getByRole("radio", { name: /Escala/ }));
    await user.click(screen.getByRole("button", { name: "Usar este número" }));

    await waitFor(() => expect(screen.getByText("Só a liderança escolhe o número.")).toBeInTheDocument());
    expect(screen.queryByText("forbidden_role")).not.toBeInTheDocument();
  });
});
