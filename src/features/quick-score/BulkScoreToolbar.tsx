import { Badge, Toolbar } from "@/components/ui";
import { DIM_CONFIG } from "@/lib/constants";
import type { CardScore } from "@/lib/types";

export default function BulkScoreToolbar({ cards, changedCount, absentCount, onSet }: { cards: CardScore[]; changedCount: number; absentCount: number; onSet: (dimension: "A" | "B" | "C", value: number) => void }) {
  return (
    <Toolbar className="quick-score-bulk">
      <div className="quick-score-bulk__title">
        <strong>批量设置</strong>
        <span>整班统一调整后，仍可单独修改学生。</span>
      </div>
      <div className="quick-score-bulk__dimensions">
        {DIM_CONFIG.map((dimension) => (
          <div key={dimension.key} className="quick-score-bulk__dimension">
            <span>{dimension.label}</span>
            <div>{[0, 1, 2, 3, 4, 5].map((score) => (
              <button key={score} type="button" onClick={() => onSet(dimension.key, score)} className={`quick-score-value quick-score-value--${score}`}>{score}</button>
            ))}</div>
          </div>
        ))}
      </div>
      <div className="quick-score-bulk__status">
        <Badge tone={changedCount > 0 ? "info" : "neutral"}>已修改 {changedCount}/{cards.length} 人</Badge>
        {absentCount > 0 && <Badge tone="danger">{absentCount} 人缺勤</Badge>}
      </div>
    </Toolbar>
  );
}
