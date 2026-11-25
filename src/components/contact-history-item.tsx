import { contactTypeLabel, formatContactDate } from "@/lib/contact-history";
import type { ContactChannel } from "@/types";

const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

// Iconos de canal, los mismos de `lists/ContactHistoryItem` del sistema de
// diseño. Decorativos: el canal se anuncia con su etiqueta.
function ChannelIcon({ type }: { type: ContactChannel }) {
  switch (type) {
    case "llamada":
      return (
        <svg {...iconProps}>
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C10.5 21 3 13.5 3 6a2 2 0 0 1 2-2z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...iconProps}>
          <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-5A8 8 0 1 1 21 12z" />
        </svg>
      );
    case "correo":
      return (
        <svg {...iconProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
    case "redes":
      return (
        <svg {...iconProps}>
          <circle cx="18" cy="5" r="2.3" />
          <circle cx="6" cy="12" r="2.3" />
          <circle cx="18" cy="19" r="2.3" />
          <path d="M8.1 10.8l7.8-4.4M8.1 13.2l7.8 4.4" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5z" />
        </svg>
      );
  }
}

// Entrada del historial de interacciones de la ficha P3 (ARC-14), portada de
// `lists/ContactHistoryItem` del sistema de diseño. Solo lectura: en el MVP no
// se editan ni se borran interacciones. Devuelve un <li> para un <ul>; la línea
// divisoria la pone la lista (`divide-y`).
export function ContactHistoryItem({
  type,
  date,
  note,
  author,
}: {
  type: ContactChannel;
  // `YYYY-MM-DD`, la fecha elegida al anotar.
  date: string;
  note: string;
  // Ya resuelto con `contactAuthor` («Antonio (anotada por Miriam)»).
  author: string;
}) {
  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-secondary-600 flex items-center gap-1">
          <ChannelIcon type={type} />
          <span className="text-text-secondary text-sm font-medium">
            {contactTypeLabel(type)}
          </span>
        </span>
        <span className="text-text-tertiary shrink-0 text-xs">
          {formatContactDate(date)}
        </span>
      </div>
      <p className="text-text-primary text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
        {note}
      </p>
      <span className="text-text-tertiary text-xs">— {author}</span>
    </li>
  );
}
