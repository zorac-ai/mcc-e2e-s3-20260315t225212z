.PHONY: build test test-rust test-js clean

# Build both WASM targets
build:
	cd issue-tracker-wasm && wasm-pack build --target bundler --out-dir pkg
	cd issue-tracker-wasm && wasm-pack build --target nodejs --out-dir pkg-node
	cd frontend && npm install

# Run all tests (Rust unit tests + JavaScript/WASM tests)
test: test-rust test-js

test-rust:
	cd issue-tracker-wasm && cargo test

test-js:
	cd frontend && npm test

clean:
	cd issue-tracker-wasm && cargo clean
	rm -rf issue-tracker-wasm/pkg issue-tracker-wasm/pkg-node
	rm -rf frontend/node_modules frontend/dist
