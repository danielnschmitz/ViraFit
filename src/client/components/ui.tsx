import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';

export const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 transition';
export const labelCls = 'block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1';
export const cardCls = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-xs transition cursor-pointer disabled:opacity-60';
export const btnGhost =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer';
export const btnIcon =
  'p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer';

export const Field: React.FC<{ label: string; htmlFor?: string; className?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  className,
  children,
}) => (
  <div className={className}>
    <label htmlFor={htmlFor} className={labelCls}>
      {label}
    </label>
    {children}
  </div>
);

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, wide }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full ${
          wide ? 'max-w-4xl' : 'max-w-2xl'
        } p-6 shadow-xl my-8`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} className={btnIcon} aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
};

export const ErrorBox: React.FC<{ error: string | null; onClose: () => void }> = ({ error, onClose }) =>
  error ? (
    <div
      role="alert"
      className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between gap-3"
    >
      <span>{error}</span>
      <button type="button" onClick={onClose} aria-label="Fechar erro">
        <X className="w-4 h-4" />
      </button>
    </div>
  ) : null;

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Carregando dados...',
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 gap-3">
    <div className="w-8 h-8 rounded-full border-3 border-emerald-600/20 border-t-emerald-600 animate-spin" />
    <span className="text-sm font-medium">{message}</span>
  </div>
);

/**
 * Listbox customizada com busca e botão/opção de cadastrar novo item.
 */
export const SearchableListbox: React.FC<{
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
  createLabel: string;
  onCreateOptionClick: () => void;
  searchable?: boolean;
}> = ({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  createLabel,
  onCreateOptionClick,
  searchable = true,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selectedOption = options.find((o) => o.id === value || o.name === value);

  const filtered = searchable && search.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    } else if (!open) {
      setSearch('');
    }
  }, [open, searchable]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left cursor-pointer`}
      >
        <span className={selectedOption ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden"
        >
          {searchable && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-700">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Pesquisar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3.5 py-2.5 text-xs text-slate-400 text-center">
                Nenhum item encontrado
              </li>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedOption?.id === item.id;
                return (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(item.id, item.name);
                      setOpen(false);
                    }}
                    className={`px-3.5 py-2 text-sm cursor-pointer flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{item.name}</span>
                  </li>
                );
              })
            )}
          </ul>

          <div className="p-1.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateOptionClick();
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {createLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
