import { useEffect, useRef, useState } from 'react';
import { HELP } from '../help/content';

interface Props {
  entree: string | null;
}

export function HelpView({ entree }: Props) {
  const [filtre, setFiltre] = useState('');
  const cible = useRef<HTMLElement | null>(null);

  useEffect(() => {
    cible.current?.scrollIntoView({ block: 'start' });
  }, [entree]);

  const texte = filtre.trim().toLowerCase();
  const visibles = HELP.filter(
    (h) => !texte || `${h.titre} ${h.mesure} ${h.calcul} ${h.probleme}`.toLowerCase().includes(texte),
  );
  const groupes = ['Règles', 'Machine learning', 'Notions'] as const;

  return (
    <section className="aide">
      <label className="champ">
        Chercher dans l'aide
        <input value={filtre} onChange={(e) => setFiltre(e.target.value)} type="search" />
      </label>
      <nav aria-label="Sommaire de l'aide" className="sommaire">
        {visibles.map((h) => (
          <a key={h.id} href={`#aide-${h.id}`}>{h.titre}</a>
        ))}
      </nav>
      {groupes.map((g) => {
        const items = visibles.filter((h) => h.groupe === g);
        if (items.length === 0) return null;
        return (
          <div key={g}>
            <h2>{g}</h2>
            {items.map((h) => (
              <article
                key={h.id}
                id={`aide-${h.id}`}
                className={`aide-entree ${h.id === entree ? 'cible' : ''}`}
                ref={h.id === entree ? cible : undefined}
              >
                <h3>{h.titre}</h3>
                <h4>Ce que ça mesure</h4>
                <p>{h.mesure}</p>
                <h4>Comment c'est calculé</h4>
                <p>{h.calcul}</p>
                <h4>Quand ça pose problème</h4>
                <p>{h.probleme}</p>
              </article>
            ))}
          </div>
        );
      })}
      {visibles.length === 0 && <p className="doux">Aucune entrée ne correspond.</p>}
    </section>
  );
}
