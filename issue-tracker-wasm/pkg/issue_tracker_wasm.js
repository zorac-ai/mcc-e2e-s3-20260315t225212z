/* @ts-self-types="./issue_tracker_wasm.d.ts" */

import * as wasm from "./issue_tracker_wasm_bg.wasm";
import { __wbg_set_wasm } from "./issue_tracker_wasm_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    add_issue, close_issue, list_issues
} from "./issue_tracker_wasm_bg.js";
