import * as React from "react";
import { useState } from "react";
import Rule from "./Rule";
import { RULE_COLORS } from "./App";

// const STOP_STATUSES = ["Existing", "Planned"];

const distanceToFraction = {
  0.25: "1/4",
  0.5: "1/2",
  0.75: "3/4",
  1: "1",
};

const joinModes = (modes) => {
  switch (modes.length) {
    case 0:
      return "no";
    case 1:
      return modes[0];
    case 2:
      return `${modes[0]} and ${modes[1]}`;
    default:
      return `${modes.slice(0, -1).join(", ")}, and ${modes[modes.length - 1]}`;
  }
};

function ControlPanel({ openModal, rules, updateRules }) {
  const [activeRuleId, setActiveRuleId] = useState(() => rules[0]?.id ?? null);

  const updateRuleWithId = (ruleId, newRule) =>
    updateRules(
      rules.map((rule) => {
        if (rule.id === ruleId) {
          return newRule;
        } else {
          return rule;
        }
      }),
    );

  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <h3>Bring Your Own TOD</h3>
      </div>
      <hr />

      <>
        {rules.map((rule, index) => (
          <div key={rule.id} className="rule-accordion">
            <button
              className="rule-accordion-header"
              onClick={() =>
                setActiveRuleId(activeRuleId === rule.id ? null : rule.id)
              }
            >
              <span className="rule-accordion-title">
                <span
                  className="rule-color-swatch"
                  style={{
                    background: RULE_COLORS[index % RULE_COLORS.length],
                  }}
                />
                Tier {index + 1}
              </span>
              <span>{activeRuleId === rule.id ? "▾" : "▸"}</span>
            </button>
            {activeRuleId === rule.id ? (
              <div className="rule-accordion-body">
                <Rule
                  selectedTypes={rule.types}
                  distance={rule.distance}
                  minDensity={rule.minDensity}
                  openModal={openModal}
                  industrial={rule.industrial}
                  onToggleType={(newType) =>
                    updateRuleWithId(rule.id, {
                      ...rule,
                      types: rule.types.includes(newType)
                        ? rule.types.filter((t) => t !== newType)
                        : [...rule.types, newType],
                    })
                  }
                  onDistanceChange={(newDistance) =>
                    updateRuleWithId(rule.id, {
                      ...rule,
                      distance: newDistance,
                    })
                  }
                  onMinDensityChange={(newMinDensity) =>
                    updateRuleWithId(rule.id, {
                      ...rule,
                      minDensity: newMinDensity,
                    })
                  }
                  setIndustrial={() =>
                    updateRuleWithId(rule.id, {
                      ...rule,
                      industrial: !rule.industrial,
                    })
                  }
                  setSFR={() =>
                    updateRuleWithId(rule.id, {
                      ...rule,
                      sfr: !rule.sfr,
                    })
                  }
                  sfr={rule.sfr}
                  removeRule={
                    rules.length === 1
                      ? null
                      : () => updateRules(rules.filter((r) => rule.id !== r.id))
                  }
                />
              </div>
            ) : (
              <div className="rule-accordion-body">
                <p>
                  <em>
                    {rule.minDensity} du/acre{" "}
                    {distanceToFraction[rule.distance]} miles from{" "}
                    {joinModes(rule.types)} stations
                  </em>
                </p>
              </div>
            )}
          </div>
        ))}
        <div className="control-section">
          <button
            onClick={() => {
              const newId = window.crypto.randomUUID();
              updateRules([
                ...rules,
                {
                  types: [],
                  industrial: false,
                  sfr: true,
                  minDensity: 60,
                  distance: 0.5,
                  id: newId,
                },
              ]);
              setActiveRuleId(newId);
            }}
          >
            Add Tier
          </button>
        </div>
        <div className="control-section">
          <button className="link-button" onClick={openModal}>
            wtf is a du/acre?
          </button>
        </div>
      </>
    </div>
  );
}

export default React.memo(ControlPanel);
