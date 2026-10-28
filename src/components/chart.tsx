import { chartDays, number, shortDate, rangeStart } from "@/lib/metrics";
import type { Daily, DateRange } from "@/lib/model";
import { useId } from "react";

export function ActivityChart({
  daily,
  range,
  now,
}: {
  daily: Daily[];
  range: DateRange;
  now: string;
}) {
  const fillId = useId();
  const points = chartDays(daily, range, now);
  if (!points.length)
    return (
      <div className="empty-state chart-empty">
        <h3>No activity in this period</h3>
        <p>Daily results will appear here when there is activity.</p>
      </div>
    );
  const max = Math.max(5, ...points.map((p) => Math.max(p.sent, p.replies)));
  const ceiling = Math.ceil(max / 50) * 50;
  const firstDay = rangeStart(range, now) || points[0].day;
  const firstTime = Date.parse(firstDay);
  const lastTime = Date.parse(now.slice(0, 10));
  const span = Math.max(86400000, lastTime - firstTime);
  return (
    <>
      <div className="chart-wrap">
        {[800, 360].map((width) => {
          const left = 48;
          const right = width === 360 ? 338 : 752;
          const x = (i: number) => left + ((Date.parse(points[i].day) - firstTime) * (right - left)) / span;
          const y = (v: number) => 196 - (v / ceiling) * 168;
          const path = (key: "sent" | "replies") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
          const ticks = width === 360 ? [0, 2, 4] : [0, 1, 2, 3, 4];
          return <svg key={width} className={width === 360 ? "chart-mobile" : "chart-desktop"}
            role="img"
            aria-label="Daily emails sent and reported replies, using the same count scale"
            viewBox={`0 0 ${width} 240`}
          >
          <title>Daily outreach activity</title>
          <defs><linearGradient id={`${fillId}-${width}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--blue)" stopOpacity="0.14" /><stop offset="100%" stopColor="var(--blue)" stopOpacity="0.01" /></linearGradient></defs>
          {[0, 1, 2, 3, 4].map((n) => (
            <g key={n}>
              <line
                className="chart-grid"
                x1={left}
                x2={right}
                y1={y((ceiling * n) / 4)}
                y2={y((ceiling * n) / 4)}
              />
              <text
                className="chart-label"
                x={left - 10}
                y={y((ceiling * n) / 4) + 4}
                textAnchor="end"
              >
                {width === 360 ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format((ceiling * n) / 4) : number((ceiling * n) / 4)}
              </text>
            </g>
          ))}
          <path
            className="chart-area"
            style={{ fill: `url(#${fillId}-${width})`, opacity: 1 }}
            d={`${path("sent")} L${x(points.length - 1)},196 L${x(0)},196 Z`}
          />
          <path className="chart-sent" d={path("sent")} />
          <path className="chart-replies" d={path("replies")} />
          {points.map((p, i) => (
            <g
              key={p.day}
              tabIndex={0}
              role="img"
              aria-label={`${shortDate(p.day)}: ${p.sent} sent, ${p.replies} reported replies`}
            >
              <title>{`${shortDate(p.day)} · ${p.sent} sent · ${p.replies} reported replies`}</title>
              <circle
                className="chart-point"
                style={points.length === 1 ? { opacity: 1 } : undefined}
                cx={x(i)}
                cy={y(p.sent)}
                r="4"
              />
            </g>
          ))}
          {ticks.map((i) => (
            <text
              className="chart-label"
              key={i}
              x={left + (i * (right - left)) / 4}
              y="224"
              textAnchor="middle"
            >
              {shortDate(new Date(firstTime + (span * i) / 4).toISOString())}
            </text>
          ))}
        </svg>;
        })}
      </div>
      <p className="chart-note">
        Daily replies may include automatic responses. People can appear on more
        than one day.
      </p>
      <details className="chart-data">
        <summary>View chart data</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>Emails sent</th>
                <th>Reported replies</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day}>
                  <td>{shortDate(p.day)}</td>
                  <td>{number(p.sent)}</td>
                  <td>{number(p.replies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
