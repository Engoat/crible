import { useEffect, useState } from 'react';
import { findColumn } from '../engine/rules/build';
import { describeRule } from '../engine/rules/describe';
import { refColumns } from '../engine/rules/model';
import type { Rule } from '../engine/rules/model';
import { fetchDefects } from '../engine/rules/run';
import type { DefectPage } from '../engine/rules/run';
import type { ColumnInfo } from '../engine/types';
import { nombre } from './format';

interface Props {
  rule: Rule;
  columns: ColumnInfo[];
  total: number;
  onClose(): void;
}

const PAGE = 100;

export function FaultyRows({ rule, columns, total, onClose }: Props) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<DefectPage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    setData(null);
    fetchDefects(rule, columns, page * PAGE, PAGE)
      .then((d) => actif && setData(d))
      .catch((e) => actif && setErreur(e instanceof Error ? e.message : String(e)));
    return () => {
      actif = false;
    };
  }, [rule, columns, page]);

  const causes = new Set(refColumns(rule).map((n) => findColumn(columns, n)?.name));
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <section className="fautives" aria-label="Lignes fautives">
      <div className="fautives-tete">
        <h3>Lignes en défaut</h3>
        <p>{describeRule(rule)}</p>
        <button type="button" onClick={onClose}>Fermer</button>
      </div>
      {erreur && <p className="message-erreur">{erreur}</p>}
      {!data && !erreur && <p className="doux">Chargement…</p>}
      {data && data.lignes.length === 0 && <p className="doux">Aucune ligne à afficher.</p>}
      {data && data.lignes.length > 0 && (
        <>
          <div className="echantillon grand">
            <table>
              <thead>
                <tr>
                  <th>Ligne</th>
                  {data.colonnes.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.lignes.map((row) => (
                  <tr key={row._ligne}>
                    <td>{row._ligne}</td>
                    {data.colonnes.map((c) => (
                      <td key={c} className={causes.has(c) ? 'cause' : ''}>
                        {row[c] ?? <em>vide</em>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>Précédentes</button>
            <span>
              Lignes {nombre(page * PAGE + 1)} à {nombre(Math.min((page + 1) * PAGE, total))} sur {nombre(total)}
            </span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= pages}>Suivantes</button>
          </div>
        </>
      )}
    </section>
  );
}
