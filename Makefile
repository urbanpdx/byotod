.PHONY: all download generate

# Download the source data, then build the datasets from it. Run as two
# recipe steps, not prerequisites, so make -j cannot start them in parallel.
all:
	$(MAKE) download
	$(MAKE) generate

download:
	uv run download_data.py

generate:
	uv run generate_dataset.py
