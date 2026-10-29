import Modal from "react-modal";

function DuAcreModal({ closeModal, isOpen }) {
  return (
    <Modal isOpen={isOpen}>
      <h2>Wtf is a du/acre?</h2>
      <p>
        Short for "dwelling units per acre", du/acre is a measure of density.
        Metro uses it as a standard way to measure the density allowed in
        different zoning categories across the Portland area.
      </p>
      <p>
        BYOTOD gives you a couple options for density allowed in TOD zones. Here
        are some visuals of what that might look like:
      </p>
      <p>
        <em>
          <a href="https://www.lincolninst.edu/data/visualizing-density/">
            Photos are sourced from the Lincoln Institute's Visualizing Density
            project
          </a>
        </em>
      </p>
      <p>
        <strong>30 du/acre</strong>
      </p>
      <img src="/30duacre.webp" alt="densely packed rowhouses"></img>
      <p>
        <em>Low rise housing with multiple units per lot</em>
      </p>
      <p>
        <strong>60 du/acre</strong>
      </p>
      <img
        src="/60duacre.webp"
        alt="a neighborhood with a mix of 3 and 4 story apartment buildings"
      ></img>
      <p>
        <em>Mid- and low-rise apartments</em>
      </p>
      <p>
        <strong>100 du/acre</strong>
      </p>
      <img
        src="/100duacre.webp"
        alt="a dense cluster of five and six story apartment buildings"
      ></img>
      <p>
        <em>Dense, mid-rise apartments</em>
      </p>
      <p>
        <strong>200 du/acre</strong>
      </p>
      <img
        src="/200duacre.webp"
        alt="a neighborhood full of 8 to 20 story apartment buildings"
      ></img>
      <p>
        <em>Mid- and high-rise apartments</em>
      </p>
      <button onClick={closeModal}>Close</button>
    </Modal>
  );
}

export default DuAcreModal;
