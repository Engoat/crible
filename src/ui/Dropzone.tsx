import { useRef, useState } from 'react';

interface Props {
  onFile(file: File): void;
  compact?: boolean;
}

const DEMOS = [
  { fichier: 'titanic.csv', label: 'Titanic' },
  { fichier: 'winequality-red.csv', label: 'Vins rouges' },
  { fichier: 'winequality-white.csv', label: 'Vins blancs' },
];

export function Dropzone({ onFile, compact }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function demo(fichier: string) {
    setErreur(null);
    try {
      const reponse = await fetch(`${import.meta.env.BASE_URL}demo/${fichier}`);
      if (!reponse.ok) throw new Error(`Fichier de démonstration introuvable (${reponse.status}).`);
      onFile(new File([await reponse.blob()], fichier, { type: 'text/csv' }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div
      className={`depot ${survol ? 'survol' : ''} ${compact ? 'compact' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <p>{compact ? 'Charger un autre fichier' : 'Dépose un fichier CSV ou Excel ici'}</p>
      <button type="button" className="primaire" onClick={() => input.current?.click()}>
        Choisir un fichier
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      {!compact && (
        <>
          <p className="doux">Les données restent dans ton navigateur : rien n'est envoyé.</p>
          <div className="demos">
            <span className="doux">Ou essaie avec un jeu de démonstration :</span>
            {DEMOS.map((d) => (
              <button key={d.fichier} type="button" onClick={() => demo(d.fichier)}>{d.label}</button>
            ))}
          </div>
          {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
        </>
      )}
    </div>
  );
}
