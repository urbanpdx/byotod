const TRANSIT_TYPES = ["MAX", "Street Car", "WES", "BUS", "FX"];
function Rule({
  selectedTypes,
  onToggleType,
  distance,
  onDistanceChange,
  minDensity,
  onMinDensityChange,
  industrial,
  sfr,
  setSFR,
  setIndustrial,
  removeRule,
}) {
  return (
    <>
      <div className="control-section">
        <label className="section-label">Transit modes</label>
        {TRANSIT_TYPES.map((type) => (
          <div key={type} className="input">
            <input
              type="checkbox"
              id={`type-${type}`}
              checked={selectedTypes.includes(type)}
              onChange={() => onToggleType(type)}
            />
            <label htmlFor={`type-${type}`}>{type}</label>
          </div>
        ))}
        <em>
          Includes approximate locations for FX service on 82nd and TV Highway
        </em>
      </div>

      <div className="control-section">
        <label className="section-label" htmlFor="industrial">
          Override industrial zoning?
        </label>
        <input
          type="checkbox"
          id="industrial"
          checked={industrial}
          onChange={(e) => {
            setIndustrial(!industrial);
          }}
        />
      </div>

      <div className="control-section">
        <label className="section-label" htmlFor="sfr">
          Override single family zoning?
        </label>
        <input
          type="checkbox"
          id="sfr"
          checked={sfr}
          onChange={(e) => {
            setSFR(!sfr);
          }}
        />
      </div>

      <div className="control-section">
        <label className="section-label" htmlFor="distance">
          Distance from station
        </label>
        <select
          id="distance"
          value={distance}
          onChange={(e) => onDistanceChange(Number(e.target.value))}
        >
          <option value={0.25}>1/4 mile</option>
          <option value={0.5}>1/2 mile</option>
          <option value={0.75}>3/4 mile</option>
          <option value={1}>1 mile</option>
        </select>
      </div>

      <div className="control-section">
        <label className="section-label" htmlFor="density">
          Density Allowed
        </label>
        <select
          id="density"
          value={minDensity}
          onChange={(e) => onMinDensityChange(Number(e.target.value))}
        >
          <option value={30}>30 du/acre</option>
          <option value={60}>60 du/acre</option>
          <option value={100}>100 du/acre</option>
          <option value={200}>200 du/acre</option>
        </select>
      </div>
      {removeRule && (
        <div className="control-section">
          <button onClick={() => removeRule()}>Remove this rule</button>
        </div>
      )}
    </>
  );
}

export default Rule;
