import { useId, useState, type ReactNode } from "react";
import { lerNumero, textoNumero } from "../util/numeros";

export function Ecra({ titulo, voltar, acoes, children }: { titulo: string; voltar?: () => void; acoes?: ReactNode; children: ReactNode }) {
  return (
    <div className="ecra">
      <header className="cabecalho">
        {voltar ? (
          <button className="botao-icone" onClick={voltar} aria-label="Voltar">
            ←
          </button>
        ) : (
          <span className="logotipo" aria-hidden>
            ▲
          </span>
        )}
        <h1>{titulo}</h1>
        <div className="cabecalho-acoes">{acoes}</div>
      </header>
      <main className="conteudo">{children}</main>
    </div>
  );
}

export function Aviso({ tipo = "info", titulo, children }: { tipo?: "info" | "sucesso" | "atencao" | "erro"; titulo?: string; children: ReactNode }) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
      {titulo && <strong>{titulo}</strong>}
      <div>{children}</div>
    </div>
  );
}

export function Campo({ rotulo, ajuda, children }: { rotulo: string; ajuda?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {children(id)}
      {ajuda && <small className="ajuda">{ajuda}</small>}
    </div>
  );
}

/** Campo numérico que aceita vírgula decimal e espaços (formato português). */
export function CampoNumero({
  rotulo,
  ajuda,
  valor,
  onChange,
  sufixo,
}: {
  rotulo: string;
  ajuda?: ReactNode;
  valor: number | null;
  onChange: (n: number | null) => void;
  sufixo?: string;
}) {
  const [texto, setTexto] = useState(textoNumero(valor));
  const invalido = texto.trim() !== "" && lerNumero(texto) === null;
  return (
    <Campo rotulo={rotulo} ajuda={invalido ? <span className="erro-texto">Número inválido</span> : ajuda}>
      {(id) => (
        <div className="com-sufixo">
          <input
            id={id}
            inputMode="decimal"
            value={texto}
            aria-invalid={invalido}
            onChange={(e) => {
              setTexto(e.target.value);
              onChange(lerNumero(e.target.value));
            }}
          />
          {sufixo && <span className="sufixo">{sufixo}</span>}
        </div>
      )}
    </Campo>
  );
}

export function CampoPalavraPasse({ rotulo, valor, onChange, autoComplete, ajuda }: { rotulo: string; valor: string; onChange: (v: string) => void; autoComplete: string; ajuda?: ReactNode }) {
  const [ver, setVer] = useState(false);
  return (
    <Campo rotulo={rotulo} ajuda={ajuda}>
      {(id) => (
        <div className="com-sufixo">
          <input id={id} type={ver ? "text" : "password"} value={valor} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="botao-ligacao" onClick={() => setVer(!ver)}>
            {ver ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      )}
    </Campo>
  );
}

export function Opcao({
  titulo,
  descricao,
  etiqueta,
  desativada,
  selecionada,
  onClick,
}: {
  titulo: string;
  descricao: ReactNode;
  etiqueta?: string;
  desativada?: boolean;
  selecionada?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`opcao${selecionada ? " selecionada" : ""}`} disabled={desativada} onClick={onClick} aria-pressed={selecionada}>
      <span className="opcao-titulo">
        {titulo}
        {etiqueta && <span className="etiqueta">{etiqueta}</span>}
      </span>
      <span className="opcao-descricao">{descricao}</span>
    </button>
  );
}

export function Passos({ atual, total }: { atual: number; total: number }) {
  return (
    <p className="passos" aria-label={`Passo ${atual} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < atual ? "feito" : ""} />
      ))}
    </p>
  );
}
