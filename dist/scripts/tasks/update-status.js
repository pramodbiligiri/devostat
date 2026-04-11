"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTaskStatus = updateTaskStatus;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const VALID_STATUSES = [
    'pending', 'in-progress', 'de-risked', 'agent-coded',
    'closed', 'needs-triage', 'abandoned',
];
function updateTaskStatus(xml, taskId, status, closedAtVersion) {
    if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status: "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    // Match the opening <task> tag for this id
    const tagPattern = new RegExp(`(<task\\s[^>]*id="${taskId}"[^>]*)status="[^"]*"`, 's');
    if (!tagPattern.test(xml)) {
        throw new Error(`Task ${taskId} not found in XML`);
    }
    let result = xml.replace(tagPattern, `$1status="${status}"`);
    if (status === 'closed' && closedAtVersion) {
        // Update <closed-at-version> within this task's block only
        result = replaceInTaskBlock(result, taskId, /<closed-at-version>[^<]*<\/closed-at-version>/, `<closed-at-version>${closedAtVersion}</closed-at-version>`);
    }
    return result;
}
function replaceInTaskBlock(xml, taskId, pattern, replacement) {
    // Find the task block and apply replacement only within it
    const blockPattern = new RegExp(`(<task\\s[^>]*id="${taskId}"[^>]*>[\\s\\S]*?</task>)`);
    return xml.replace(blockPattern, (block) => block.replace(pattern, replacement));
}
// CLI entrypoint
if (require.main === module) {
    const args = process.argv.slice(2);
    const planIdx = args.indexOf('--plan');
    const taskIdx = args.indexOf('--task');
    const statusIdx = args.indexOf('--status');
    const versionIdx = args.indexOf('--version');
    if (planIdx === -1 || taskIdx === -1 || statusIdx === -1) {
        console.error('Usage: node update-status.js --plan <N> --task <id> --status <status> [--version <plan-version>]');
        process.exit(1);
    }
    const planNum = parseInt(args[planIdx + 1], 10);
    const taskId = parseInt(args[taskIdx + 1], 10);
    const status = args[statusIdx + 1];
    const closedAtVersion = versionIdx !== -1 ? args[versionIdx + 1] : '';
    const xmlPath = path.join('.agents', 'plans', `plan-${planNum}-tasks.xml`);
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    const updated = updateTaskStatus(xml, taskId, status, closedAtVersion);
    fs.writeFileSync(xmlPath, updated, 'utf-8');
    console.log(`Task ${taskId} status set to "${status}"`);
}
