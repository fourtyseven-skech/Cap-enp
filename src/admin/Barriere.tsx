import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Barrière d'erreur du panel.
 *
 * Sans elle, une exception dans n'importe quel module du panel produit une page
 * entièrement blanche, sans indication — c'est exactement ce qui s'est produit
 * quand `gray-matter` a tenté d'appeler `Buffer.from` dans le navigateur : le
 * chargement différé échouait, le `Suspense` affichait son repli vide, et il ne
 * restait rien à l'écran ni dans la console.
 *
 * Une panne doit rester lisible. Mieux vaut un message laid qu'un écran muet.
 */
type Props = { children: ReactNode };
type State = { erreur: Error | null; composants: string | null };

class Barriere extends Component<Props, State> {
  state: State = { erreur: null, composants: null };

  static getDerivedStateFromError(erreur: Error): State {
    return { erreur, composants: null };
  }

  /**
   * `info.componentStack` est la seule information utile d'un plantage en
   * production, et elle était jetée.
   *
   * React minifié ne dit que « Minified React error #130 » avec un lien vers
   * un décodeur : le message ne nomme ni le composant, ni l'écran. Le
   * 6 septembre 2026, ouvrir un article sans motif de couverture faisait
   * tomber le panel entier, et ce code d'erreur ne permettait de remonter à
   * rien — il a fallu reconstruire le panel non minifié pour trouver la cause.
   *
   * `componentStack` donne l'arbre des composants en cours de rendu. Il est
   * affiché à l'écran, sous le message : c'est ce qu'on demandera de recopier
   * en cas de panne, et cela suffit à situer le fautif.
   */
  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error("[panel] échec du rendu :", erreur, info.componentStack);
    this.setState({ composants: info.componentStack ?? null });
  }

  render() {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg border border-red-200 rounded-md bg-white overflow-hidden">
          <header className="px-3 h-9 flex items-center border-b border-red-200 bg-red-50">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-red-700">
              Le panel n'a pas pu s'afficher
            </h2>
          </header>
          <div className="p-4">
            <p className="text-[12px] leading-relaxed text-slate-700 mb-3">
              Une erreur est survenue au chargement. Le message ci-dessous suffit généralement à identifier
              la cause :
            </p>
            <pre className="p-2.5 rounded bg-slate-100 text-[11px] font-mono text-red-700 whitespace-pre-wrap break-words">
              {erreur.message || String(erreur)}
            </pre>

            {/* L'arbre des composants : c'est lui qui situe la panne quand le
                message, lui, n'est qu'un numéro. */}
            {this.state.composants && (
              <details className="mt-2">
                <summary className="text-[11px] font-semibold text-slate-600 cursor-pointer">
                  Où exactement — à recopier en cas de demande d'assistance
                </summary>
                <pre className="mt-1.5 p-2.5 rounded bg-slate-100 text-[10.5px] font-mono text-slate-600 whitespace-pre-wrap break-words max-h-52 overflow-y-auto">
                  {this.state.composants.trim()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-3 h-8 px-3 rounded border border-slate-300 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default Barriere;
