-- Additional performance indexes for the intelligence layer.
-- Supports CLV (predicted_ltv DESC), restock/demand (demand_score DESC), and
-- segment group-by queries served by the BFF intelligence routes.

CREATE INDEX IF NOT EXISTS "ml_predictions_subject_type_predicted_ltv_idx"
  ON "ml_predictions" ("subject_type", "predicted_ltv");

CREATE INDEX IF NOT EXISTS "ml_predictions_subject_type_demand_score_idx"
  ON "ml_predictions" ("subject_type", "demand_score");

CREATE INDEX IF NOT EXISTS "ml_predictions_segment_idx"
  ON "ml_predictions" ("segment");
