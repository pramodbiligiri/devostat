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
exports.addComment = addComment;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function assertTaskExists(xml, taskId) {
    if (!new RegExp(`<task\\s[^>]*id="${taskId}"`).test(xml)) {
        throw new Error(`Task ${taskId} not found in XML`);
    }
}
function addComment(xml, taskId, message, timestamp) {
    assertTaskExists(xml, taskId);
    const entry = `<comment timestamp="${timestamp}">${escapeXml(message)}</comment>`;
    return xml.replace(new RegExp(`(<task\\s[^>]*id="${taskId}"[\\s\\S]*?<comments>)(</comments>|([\\s\\S]*?))(</comments>)`), (_match, open, _body, _inner, close) => {
        const existing = _body === '</comments>' ? '' : _body;
        return `${open}${existing}\n        ${entry}\n      ${close}`;
    });
}
// CLI entrypoint
if (require.main === module) {
    const args = process.argv.slice(2);
    const planIdx = args.indexOf('--plan');
    const taskIdx = args.indexOf('--task');
    const msgIdx = args.indexOf('--message');
    if (planIdx === -1 || taskIdx === -1 || msgIdx === -1) {
        console.error('Usage: node add-comment.js --plan <N> --task <id> --message <text>');
        process.exit(1);
    }
    const planNum = parseInt(args[planIdx + 1], 10);
    const taskId = parseInt(args[taskIdx + 1], 10);
    const message = args[msgIdx + 1];
    const timestamp = new Date().toISOString();
    const xmlPath = path.join('.agents', 'plans', `plan-${planNum}-tasks.xml`);
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    const updated = addComment(xml, taskId, message, timestamp);
    fs.writeFileSync(xmlPath, updated, 'utf-8');
    console.log(`Comment added to task ${taskId}`);
}
