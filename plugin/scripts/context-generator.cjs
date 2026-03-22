"use strict";var ss=Object.create;var U=Object.defineProperty;var rs=Object.getOwnPropertyDescriptor;var ns=Object.getOwnPropertyNames;var os=Object.getPrototypeOf,is=Object.prototype.hasOwnProperty;var as=(s,e)=>{for(var t in e)U(s,t,{get:e[t],enumerable:!0})},ue=(s,e,t,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of ns(e))!is.call(s,n)&&n!==t&&U(s,n,{get:()=>e[n],enumerable:!(r=rs(e,n))||r.enumerable});return s};var N=(s,e,t)=>(t=s!=null?ss(os(s)):{},ue(e||!s||!s.__esModule?U(t,"default",{value:s,enumerable:!0}):t,s)),ms=s=>ue(U({},"__esModule",{value:!0}),s);var ys={};as(ys,{generateContext:()=>de});module.exports=ms(ys);var Zt=N(require("path"),1),es=require("os"),ts=require("fs");var rt=require("bun:sqlite");var T=require("path"),J=require("os"),k=require("fs"),ce=require("child_process"),_e=require("url");var C=require("fs"),v=require("path"),le=require("os"),V=(o=>(o[o.DEBUG=0]="DEBUG",o[o.INFO=1]="INFO",o[o.WARN=2]="WARN",o[o.ERROR=3]="ERROR",o[o.SILENT=4]="SILENT",o))(V||{}),pe=(0,v.join)((0,le.homedir)(),".claude-mem"),K=class{level=null;useColor;logFilePath=null;logFileInitialized=!1;constructor(){this.useColor=process.stdout.isTTY??!1}ensureLogFileInitialized(){if(!this.logFileInitialized){this.logFileInitialized=!0;try{let e=(0,v.join)(pe,"logs");(0,C.existsSync)(e)||(0,C.mkdirSync)(e,{recursive:!0});let t=new Date().toISOString().split("T")[0];this.logFilePath=(0,v.join)(e,`claude-mem-${t}.log`)}catch(e){console.error("[LOGGER] Failed to initialize log file:",e),this.logFilePath=null}}}getLevel(){if(this.level===null)try{let e=(0,v.join)(pe,"settings.json");if((0,C.existsSync)(e)){let t=(0,C.readFileSync)(e,"utf-8"),n=(JSON.parse(t).CLAUDE_MEM_LOG_LEVEL||"INFO").toUpperCase();this.level=V[n]??1}else this.level=1}catch{this.level=1}return this.level}correlationId(e,t){return`obs-${e}-${t}`}sessionId(e){return`session-${e}`}formatData(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return e.toString();if(typeof e=="object"){if(e instanceof Error)return this.getLevel()===0?`${e.message}
${e.stack}`:e.message;if(Array.isArray(e))return`[${e.length} items]`;let t=Object.keys(e);return t.length===0?"{}":t.length<=3?JSON.stringify(e):`{${t.length} keys: ${t.slice(0,3).join(", ")}...}`}return String(e)}formatTool(e,t){if(!t)return e;let r=t;if(typeof t=="string")try{r=JSON.parse(t)}catch{r=t}if(e==="Bash"&&r.command)return`${e}(${r.command})`;if(r.file_path)return`${e}(${r.file_path})`;if(r.notebook_path)return`${e}(${r.notebook_path})`;if(e==="Glob"&&r.pattern)return`${e}(${r.pattern})`;if(e==="Grep"&&r.pattern)return`${e}(${r.pattern})`;if(r.url)return`${e}(${r.url})`;if(r.query)return`${e}(${r.query})`;if(e==="Task"){if(r.subagent_type)return`${e}(${r.subagent_type})`;if(r.description)return`${e}(${r.description})`}return e==="Skill"&&r.skill?`${e}(${r.skill})`:e==="LSP"&&r.operation?`${e}(${r.operation})`:e}formatTimestamp(e){let t=e.getFullYear(),r=String(e.getMonth()+1).padStart(2,"0"),n=String(e.getDate()).padStart(2,"0"),o=String(e.getHours()).padStart(2,"0"),i=String(e.getMinutes()).padStart(2,"0"),a=String(e.getSeconds()).padStart(2,"0"),m=String(e.getMilliseconds()).padStart(3,"0");return`${t}-${r}-${n} ${o}:${i}:${a}.${m}`}log(e,t,r,n,o){if(e<this.getLevel())return;this.ensureLogFileInitialized();let i=this.formatTimestamp(new Date),a=V[e].padEnd(5),m=t.padEnd(6),u="";n?.correlationId?u=`[${n.correlationId}] `:n?.sessionId&&(u=`[session-${n.sessionId}] `);let l="";o!=null&&(o instanceof Error?l=this.getLevel()===0?`
${o.message}
${o.stack}`:` ${o.message}`:this.getLevel()===0&&typeof o=="object"?l=`
`+JSON.stringify(o,null,2):l=" "+this.formatData(o));let _="";if(n){let{sessionId:g,memorySessionId:f,correlationId:R,...c}=n;Object.keys(c).length>0&&(_=` {${Object.entries(c).map(([S,O])=>`${S}=${O}`).join(", ")}}`)}let E=`[${i}] [${a}] [${m}] ${u}${r}${_}${l}`;if(this.logFilePath)try{(0,C.appendFileSync)(this.logFilePath,E+`
`,"utf8")}catch(g){process.stderr.write(`[LOGGER] Failed to write to log file: ${g}
`)}else process.stderr.write(E+`
`)}debug(e,t,r,n){this.log(0,e,t,r,n)}info(e,t,r,n){this.log(1,e,t,r,n)}warn(e,t,r,n){this.log(2,e,t,r,n)}error(e,t,r,n){this.log(3,e,t,r,n)}dataIn(e,t,r,n){this.info(e,`\u2192 ${t}`,r,n)}dataOut(e,t,r,n){this.info(e,`\u2190 ${t}`,r,n)}success(e,t,r,n){this.info(e,`\u2713 ${t}`,r,n)}failure(e,t,r,n){this.error(e,`\u2717 ${t}`,r,n)}timing(e,t,r,n){this.info(e,`\u23F1 ${t}`,n,{duration:`${r}ms`})}happyPathError(e,t,r,n,o=""){let u=((new Error().stack||"").split(`
`)[2]||"").match(/at\s+(?:.*\s+)?\(?([^:]+):(\d+):(\d+)\)?/),l=u?`${u[1].split("/").pop()}:${u[2]}`:"unknown",_={...r,location:l};return this.warn(e,`[HAPPY-PATH] ${t}`,_,n),o}},p=new K;var ls={};function ds(){return typeof __dirname<"u"?__dirname:(0,T.dirname)((0,_e.fileURLToPath)(ls.url))}var us=ds();function ps(){if(process.env.CLAUDE_MEM_DATA_DIR)return process.env.CLAUDE_MEM_DATA_DIR;let s=(0,T.join)((0,J.homedir)(),".claude-mem"),e=(0,T.join)(s,"settings.json");try{if((0,k.existsSync)(e)){let{readFileSync:t}=require("fs"),r=JSON.parse(t(e,"utf-8")),n=r.env??r;if(n.CLAUDE_MEM_DATA_DIR)return n.CLAUDE_MEM_DATA_DIR}}catch{}return s}var I=ps(),A=process.env.CLAUDE_CONFIG_DIR||(0,T.join)((0,J.homedir)(),".claude"),Ds=(0,T.join)(A,"plugins","marketplaces","thedotmack"),Ms=(0,T.join)(I,"archives"),Ls=(0,T.join)(I,"logs"),xs=(0,T.join)(I,"trash"),Us=(0,T.join)(I,"backups"),ks=(0,T.join)(I,"modes"),ws=(0,T.join)(I,"settings.json"),Ee=(0,T.join)(I,"claude-mem.db"),Ps=(0,T.join)(I,"vector-db"),$s=(0,T.join)(I,"observer-sessions"),Fs=(0,T.join)(A,"settings.json"),js=(0,T.join)(A,"commands"),Xs=(0,T.join)(A,"CLAUDE.md");function ge(s){(0,k.mkdirSync)(s,{recursive:!0})}function Te(){try{let s=(0,ce.execSync)("git rev-parse --show-toplevel",{cwd:process.cwd(),encoding:"utf8",stdio:["pipe","pipe","ignore"],windowsHide:!0}).trim();return(0,T.basename)((0,T.dirname)(s))+"/"+(0,T.basename)(s)}catch(s){p.debug("SYSTEM","Git root detection failed, using cwd basename",{cwd:process.cwd()},s);let e=process.cwd();return(0,T.basename)((0,T.dirname)(e))+"/"+(0,T.basename)(e)}}function fe(){return(0,T.join)(us,"..")}var w=class{constructor(e){this.db=e}runAllMigrations(){this.initializeSchema(),this.ensureWorkerPortColumn(),this.ensurePromptTrackingColumns(),this.removeSessionSummariesUniqueConstraint(),this.addObservationHierarchicalFields(),this.makeObservationsTextNullable(),this.createUserPromptsTable(),this.ensureDiscoveryTokensColumn(),this.createPendingMessagesTable(),this.renameSessionIdColumns(),this.repairSessionIdColumnRename(),this.addFailedAtEpochColumn(),this.addOnUpdateCascadeToForeignKeys(),this.addObservationContentHashColumn(),this.addSessionCustomTitleColumn()}initializeSchema(){this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        applied_at TEXT NOT NULL
      )
    `),this.db.run(`
      CREATE TABLE IF NOT EXISTS sdk_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT UNIQUE NOT NULL,
        memory_session_id TEXT UNIQUE,
        project TEXT NOT NULL,
        user_prompt TEXT,
        started_at TEXT NOT NULL,
        started_at_epoch INTEGER NOT NULL,
        completed_at TEXT,
        completed_at_epoch INTEGER,
        status TEXT CHECK(status IN ('active', 'completed', 'failed')) NOT NULL DEFAULT 'active'
      );

      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_claude_id ON sdk_sessions(content_session_id);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_sdk_id ON sdk_sessions(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project ON sdk_sessions(project);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_status ON sdk_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_started ON sdk_sessions(started_at_epoch DESC);

      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_observations_sdk_session ON observations(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project);
      CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
      CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC);

      CREATE TABLE IF NOT EXISTS session_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT UNIQUE NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project);
      CREATE INDEX IF NOT EXISTS idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(4,new Date().toISOString())}ensureWorkerPortColumn(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(r=>r.name==="worker_port")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN worker_port INTEGER"),p.debug("DB","Added worker_port column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(5,new Date().toISOString())}ensurePromptTrackingColumns(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(a=>a.name==="prompt_counter")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN prompt_counter INTEGER DEFAULT 0"),p.debug("DB","Added prompt_counter column to sdk_sessions table")),this.db.query("PRAGMA table_info(observations)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE observations ADD COLUMN prompt_number INTEGER"),p.debug("DB","Added prompt_number column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN prompt_number INTEGER"),p.debug("DB","Added prompt_number column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(6,new Date().toISOString())}removeSessionSummariesUniqueConstraint(){if(!this.db.query("PRAGMA index_list(session_summaries)").all().some(r=>r.unique===1)){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString());return}p.debug("DB","Removing UNIQUE constraint from session_summaries.memory_session_id"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS session_summaries_new"),this.db.run(`
      CREATE TABLE session_summaries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        prompt_number INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
      )
    `),this.db.run(`
      INSERT INTO session_summaries_new
      SELECT id, memory_session_id, project, request, investigated, learned,
             completed, next_steps, files_read, files_edited, notes,
             prompt_number, created_at, created_at_epoch
      FROM session_summaries
    `),this.db.run("DROP TABLE session_summaries"),this.db.run("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.run(`
      CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
      CREATE INDEX idx_session_summaries_project ON session_summaries(project);
      CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString()),p.debug("DB","Successfully removed UNIQUE constraint from session_summaries.memory_session_id")}addObservationHierarchicalFields(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(8))return;if(this.db.query("PRAGMA table_info(observations)").all().some(n=>n.name==="title")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString());return}p.debug("DB","Adding hierarchical fields to observations table"),this.db.run(`
      ALTER TABLE observations ADD COLUMN title TEXT;
      ALTER TABLE observations ADD COLUMN subtitle TEXT;
      ALTER TABLE observations ADD COLUMN facts TEXT;
      ALTER TABLE observations ADD COLUMN narrative TEXT;
      ALTER TABLE observations ADD COLUMN concepts TEXT;
      ALTER TABLE observations ADD COLUMN files_read TEXT;
      ALTER TABLE observations ADD COLUMN files_modified TEXT;
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString()),p.debug("DB","Successfully added hierarchical fields to observations table")}makeObservationsTextNullable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(9))return;let r=this.db.query("PRAGMA table_info(observations)").all().find(n=>n.name==="text");if(!r||r.notnull===0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString());return}p.debug("DB","Making observations.text nullable"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
      CREATE TABLE observations_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT,
        type TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        facts TEXT,
        narrative TEXT,
        concepts TEXT,
        files_read TEXT,
        files_modified TEXT,
        prompt_number INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
      )
    `),this.db.run(`
      INSERT INTO observations_new
      SELECT id, memory_session_id, project, text, type, title, subtitle, facts,
             narrative, concepts, files_read, files_modified, prompt_number,
             created_at, created_at_epoch
      FROM observations
    `),this.db.run("DROP TABLE observations"),this.db.run("ALTER TABLE observations_new RENAME TO observations"),this.db.run(`
      CREATE INDEX idx_observations_sdk_session ON observations(memory_session_id);
      CREATE INDEX idx_observations_project ON observations(project);
      CREATE INDEX idx_observations_type ON observations(type);
      CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString()),p.debug("DB","Successfully made observations.text nullable")}createUserPromptsTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(10))return;if(this.db.query("PRAGMA table_info(user_prompts)").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString());return}p.debug("DB","Creating user_prompts table with FTS5 support"),this.db.run("BEGIN TRANSACTION"),this.db.run(`
      CREATE TABLE user_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT NOT NULL,
        prompt_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(content_session_id) REFERENCES sdk_sessions(content_session_id) ON DELETE CASCADE
      );

      CREATE INDEX idx_user_prompts_claude_session ON user_prompts(content_session_id);
      CREATE INDEX idx_user_prompts_created ON user_prompts(created_at_epoch DESC);
      CREATE INDEX idx_user_prompts_prompt_number ON user_prompts(prompt_number);
      CREATE INDEX idx_user_prompts_lookup ON user_prompts(content_session_id, prompt_number);
    `);try{this.db.run(`
        CREATE VIRTUAL TABLE user_prompts_fts USING fts5(
          prompt_text,
          content='user_prompts',
          content_rowid='id'
        );
      `),this.db.run(`
        CREATE TRIGGER user_prompts_ai AFTER INSERT ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(rowid, prompt_text)
          VALUES (new.id, new.prompt_text);
        END;

        CREATE TRIGGER user_prompts_ad AFTER DELETE ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
          VALUES('delete', old.id, old.prompt_text);
        END;

        CREATE TRIGGER user_prompts_au AFTER UPDATE ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
          VALUES('delete', old.id, old.prompt_text);
          INSERT INTO user_prompts_fts(rowid, prompt_text)
          VALUES (new.id, new.prompt_text);
        END;
      `)}catch(r){p.warn("DB","FTS5 not available \u2014 user_prompts_fts skipped (search uses ChromaDB)",{},r)}this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString()),p.debug("DB","Successfully created user_prompts table")}ensureDiscoveryTokensColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(11))return;this.db.query("PRAGMA table_info(observations)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE observations ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),p.debug("DB","Added discovery_tokens column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),p.debug("DB","Added discovery_tokens column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(11,new Date().toISOString())}createPendingMessagesTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(16))return;if(this.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_messages'").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString());return}p.debug("DB","Creating pending_messages table"),this.db.run(`
      CREATE TABLE pending_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_db_id INTEGER NOT NULL,
        content_session_id TEXT NOT NULL,
        message_type TEXT NOT NULL CHECK(message_type IN ('observation', 'summarize')),
        tool_name TEXT,
        tool_input TEXT,
        tool_response TEXT,
        cwd TEXT,
        last_user_message TEXT,
        last_assistant_message TEXT,
        prompt_number INTEGER,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'processed', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at_epoch INTEGER NOT NULL,
        started_processing_at_epoch INTEGER,
        completed_at_epoch INTEGER,
        FOREIGN KEY (session_db_id) REFERENCES sdk_sessions(id) ON DELETE CASCADE
      )
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_session ON pending_messages(session_db_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_claude_session ON pending_messages(content_session_id)"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString()),p.debug("DB","pending_messages table created successfully")}renameSessionIdColumns(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(17))return;p.debug("DB","Checking session ID columns for semantic clarity rename");let t=0,r=(n,o,i)=>{let a=this.db.query(`PRAGMA table_info(${n})`).all(),m=a.some(l=>l.name===o);return a.some(l=>l.name===i)?!1:m?(this.db.run(`ALTER TABLE ${n} RENAME COLUMN ${o} TO ${i}`),p.debug("DB",`Renamed ${n}.${o} to ${i}`),!0):(p.warn("DB",`Column ${o} not found in ${n}, skipping rename`),!1)};r("sdk_sessions","claude_session_id","content_session_id")&&t++,r("sdk_sessions","sdk_session_id","memory_session_id")&&t++,r("pending_messages","claude_session_id","content_session_id")&&t++,r("observations","sdk_session_id","memory_session_id")&&t++,r("session_summaries","sdk_session_id","memory_session_id")&&t++,r("user_prompts","claude_session_id","content_session_id")&&t++,this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(17,new Date().toISOString()),t>0?p.debug("DB",`Successfully renamed ${t} session ID columns`):p.debug("DB","No session ID column renames needed (already up to date)")}repairSessionIdColumnRename(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(19)||this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(19,new Date().toISOString())}addFailedAtEpochColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(20))return;this.db.query("PRAGMA table_info(pending_messages)").all().some(n=>n.name==="failed_at_epoch")||(this.db.run("ALTER TABLE pending_messages ADD COLUMN failed_at_epoch INTEGER"),p.debug("DB","Added failed_at_epoch column to pending_messages table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(20,new Date().toISOString())}addOnUpdateCascadeToForeignKeys(){if(!this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(21)){p.debug("DB","Adding ON UPDATE CASCADE to FK constraints on observations and session_summaries"),this.db.run("PRAGMA foreign_keys = OFF"),this.db.run("BEGIN TRANSACTION");try{this.db.run("DROP TRIGGER IF EXISTS observations_ai"),this.db.run("DROP TRIGGER IF EXISTS observations_ad"),this.db.run("DROP TRIGGER IF EXISTS observations_au"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
        CREATE TABLE observations_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          text TEXT,
          type TEXT NOT NULL,
          title TEXT,
          subtitle TEXT,
          facts TEXT,
          narrative TEXT,
          concepts TEXT,
          files_read TEXT,
          files_modified TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `),this.db.run(`
        INSERT INTO observations_new
        SELECT id, memory_session_id, project, text, type, title, subtitle, facts,
               narrative, concepts, files_read, files_modified, prompt_number,
               discovery_tokens, created_at, created_at_epoch
        FROM observations
      `),this.db.run("DROP TABLE observations"),this.db.run("ALTER TABLE observations_new RENAME TO observations"),this.db.run(`
        CREATE INDEX idx_observations_sdk_session ON observations(memory_session_id);
        CREATE INDEX idx_observations_project ON observations(project);
        CREATE INDEX idx_observations_type ON observations(type);
        CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
      `),this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='observations_fts'").all().length>0&&this.db.run(`
          CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
            INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
          END;

          CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
            INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
          END;

          CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
            INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
            INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
          END;
        `),this.db.run("DROP TABLE IF EXISTS session_summaries_new"),this.db.run(`
        CREATE TABLE session_summaries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          request TEXT,
          investigated TEXT,
          learned TEXT,
          completed TEXT,
          next_steps TEXT,
          files_read TEXT,
          files_edited TEXT,
          notes TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `),this.db.run(`
        INSERT INTO session_summaries_new
        SELECT id, memory_session_id, project, request, investigated, learned,
               completed, next_steps, files_read, files_edited, notes,
               prompt_number, discovery_tokens, created_at, created_at_epoch
        FROM session_summaries
      `),this.db.run("DROP TRIGGER IF EXISTS session_summaries_ai"),this.db.run("DROP TRIGGER IF EXISTS session_summaries_ad"),this.db.run("DROP TRIGGER IF EXISTS session_summaries_au"),this.db.run("DROP TABLE session_summaries"),this.db.run("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.run(`
        CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
        CREATE INDEX idx_session_summaries_project ON session_summaries(project);
        CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
      `),this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_summaries_fts'").all().length>0&&this.db.run(`
          CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
          END;

          CREATE TRIGGER IF NOT EXISTS session_summaries_ad AFTER DELETE ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
          END;

          CREATE TRIGGER IF NOT EXISTS session_summaries_au AFTER UPDATE ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
            INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
          END;
        `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(21,new Date().toISOString()),this.db.run("COMMIT"),this.db.run("PRAGMA foreign_keys = ON"),p.debug("DB","Successfully added ON UPDATE CASCADE to FK constraints")}catch(t){throw this.db.run("ROLLBACK"),this.db.run("PRAGMA foreign_keys = ON"),t}}}addObservationContentHashColumn(){if(this.db.query("PRAGMA table_info(observations)").all().some(r=>r.name==="content_hash")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(22,new Date().toISOString());return}this.db.run("ALTER TABLE observations ADD COLUMN content_hash TEXT"),this.db.run("UPDATE observations SET content_hash = substr(hex(randomblob(8)), 1, 16) WHERE content_hash IS NULL"),this.db.run("CREATE INDEX IF NOT EXISTS idx_observations_content_hash ON observations(content_hash, created_at_epoch)"),p.debug("DB","Added content_hash column to observations table with backfill and index"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(22,new Date().toISOString())}addSessionCustomTitleColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(23))return;this.db.query("PRAGMA table_info(sdk_sessions)").all().some(n=>n.name==="custom_title")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN custom_title TEXT"),p.debug("DB","Added custom_title column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(23,new Date().toISOString())}};var Se=require("crypto");var cs=3e4;function P(s,e,t){return(0,Se.createHash)("sha256").update((s||"")+(e||"")+(t||"")).digest("hex").slice(0,16)}function $(s,e,t){let r=t-cs;return s.prepare("SELECT id, created_at_epoch FROM observations WHERE content_hash = ? AND created_at_epoch > ?").get(e,r)}function be(s,e,t,r,n,o=0,i){let a=i??Date.now(),m=new Date(a).toISOString(),u=t||Te(),l=P(e,r.title,r.narrative),_=$(s,l,a);if(_)return p.debug("DEDUP",`Skipped duplicate observation | contentHash=${l} | existingId=${_.id}`),{id:_.id,createdAtEpoch:_.created_at_epoch};let g=s.prepare(`
    INSERT INTO observations
    (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
     files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e,u,r.type,r.title,r.subtitle,JSON.stringify(r.facts),r.narrative,JSON.stringify(r.concepts),JSON.stringify(r.files_read),JSON.stringify(r.files_modified),n||null,o,l,m,a);return{id:Number(g.lastInsertRowid),createdAtEpoch:a}}function he(s,e){return s.prepare(`
    SELECT *
    FROM observations
    WHERE id = ?
  `).get(e)||null}function Oe(s,e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o,type:i,concepts:a,files:m}=t,u=r==="date_asc"?"ASC":"DESC",l=n?`LIMIT ${n}`:"",_=e.map(()=>"?").join(","),E=[...e],g=[];if(o&&(g.push("project = ?"),E.push(o)),i)if(Array.isArray(i)){let c=i.map(()=>"?").join(",");g.push(`type IN (${c})`),E.push(...i)}else g.push("type = ?"),E.push(i);if(a){let c=Array.isArray(a)?a:[a],b=c.map(()=>"EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?)");E.push(...c),g.push(`(${b.join(" OR ")})`)}if(m){let c=Array.isArray(m)?m:[m],b=c.map(()=>"(EXISTS (SELECT 1 FROM json_each(files_read) WHERE value LIKE ?) OR EXISTS (SELECT 1 FROM json_each(files_modified) WHERE value LIKE ?))");c.forEach(S=>{E.push(`%${S}%`,`%${S}%`)}),g.push(`(${b.join(" OR ")})`)}let f=g.length>0?`WHERE id IN (${_}) AND ${g.join(" AND ")}`:`WHERE id IN (${_})`;return s.prepare(`
    SELECT *
    FROM observations
    ${f}
    ORDER BY created_at_epoch ${u}
    ${l}
  `).all(...E)}function Re(s,e){return s.prepare(`
    SELECT title, subtitle, type, prompt_number
    FROM observations
    WHERE memory_session_id = ?
    ORDER BY created_at_epoch ASC
  `).all(e)}function Ie(s,e,t=20){return s.prepare(`
    SELECT type, text, prompt_number, created_at
    FROM observations
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,t)}function ye(s,e=100){return s.prepare(`
    SELECT id, type, title, subtitle, text, project, prompt_number, created_at, created_at_epoch
    FROM observations
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e)}function Ce(s,e){let r=s.prepare(`
    SELECT files_read, files_modified
    FROM observations
    WHERE memory_session_id = ?
  `).all(e),n=new Set,o=new Set;for(let i of r){if(i.files_read){let a=JSON.parse(i.files_read);Array.isArray(a)&&a.forEach(m=>n.add(m))}if(i.files_modified){let a=JSON.parse(i.files_modified);Array.isArray(a)&&a.forEach(m=>o.add(m))}}return{filesRead:Array.from(n),filesModified:Array.from(o)}}function Ae(s,e,t,r,n,o=0,i){let a=i??Date.now(),m=new Date(a).toISOString(),l=s.prepare(`
    INSERT INTO session_summaries
    (memory_session_id, project, request, investigated, learned, completed,
     next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e,t,r.request,r.investigated,r.learned,r.completed,r.next_steps,r.notes,n||null,o,m,a);return{id:Number(l.lastInsertRowid),createdAtEpoch:a}}function Ne(s,e){return s.prepare(`
    SELECT
      request, investigated, learned, completed, next_steps,
      files_read, files_edited, notes, prompt_number, created_at,
      created_at_epoch
    FROM session_summaries
    WHERE memory_session_id = ?
    ORDER BY created_at_epoch DESC
    LIMIT 1
  `).get(e)||null}function ve(s,e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o}=t,i=r==="date_asc"?"ASC":"DESC",a=n?`LIMIT ${n}`:"",m=e.map(()=>"?").join(","),u=[...e],l=o?`WHERE id IN (${m}) AND project = ?`:`WHERE id IN (${m})`;return o&&u.push(o),s.prepare(`
    SELECT * FROM session_summaries
    ${l}
    ORDER BY created_at_epoch ${i}
    ${a}
  `).all(...u)}function De(s,e,t=10){return s.prepare(`
    SELECT
      request, investigated, learned, completed, next_steps,
      files_read, files_edited, notes, prompt_number, created_at
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,t)}function Me(s,e,t=3){return s.prepare(`
    SELECT
      memory_session_id, request, learned, completed, next_steps,
      prompt_number, created_at
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,t)}function Le(s,e=50){return s.prepare(`
    SELECT id, request, investigated, learned, completed, next_steps,
           files_read, files_edited, notes, project, prompt_number,
           created_at, created_at_epoch
    FROM session_summaries
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e)}function xe(s,e,t,r,n){let o=new Date,i=o.getTime(),a=s.prepare(`
    SELECT id FROM sdk_sessions WHERE content_session_id = ?
  `).get(e);return a?(t&&s.prepare(`
        UPDATE sdk_sessions SET project = ?
        WHERE content_session_id = ? AND (project IS NULL OR project = '')
      `).run(t,e),n&&s.prepare(`
        UPDATE sdk_sessions SET custom_title = ?
        WHERE content_session_id = ? AND custom_title IS NULL
      `).run(n,e),a.id):(s.prepare(`
    INSERT INTO sdk_sessions
    (content_session_id, memory_session_id, project, user_prompt, custom_title, started_at, started_at_epoch, status)
    VALUES (?, NULL, ?, ?, ?, ?, ?, 'active')
  `).run(e,t,r,n||null,o.toISOString(),i),s.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(e).id)}function Ue(s,e,t){let r=s.prepare(`
    SELECT id, memory_session_id FROM sdk_sessions WHERE id = ?
  `).get(e);if(!r)throw new Error(`Session ${e} not found in sdk_sessions`);r.memory_session_id!==t&&(s.prepare(`
      UPDATE sdk_sessions SET memory_session_id = ? WHERE id = ?
    `).run(t,e),p.info("DB","Registered memory_session_id before storage (FK fix)",{sessionDbId:e,oldId:r.memory_session_id,newId:t}))}function ke(s,e){let t=`manual-${e}`,r=`manual-content-${e}`;if(s.prepare("SELECT memory_session_id FROM sdk_sessions WHERE memory_session_id = ?").get(t))return t;let o=new Date;return s.prepare(`
    INSERT INTO sdk_sessions (memory_session_id, content_session_id, project, started_at, started_at_epoch, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(t,r,e,o.toISOString(),o.getTime()),p.info("SESSION","Created manual session",{memorySessionId:t,project:e}),t}function we(s,e,t){s.prepare(`
    UPDATE sdk_sessions
    SET memory_session_id = ?
    WHERE id = ?
  `).run(t,e)}function Pe(s,e){return s.prepare(`
    SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title
    FROM sdk_sessions
    WHERE id = ?
    LIMIT 1
  `).get(e)||null}function $e(s,e){if(e.length===0)return[];let t=e.map(()=>"?").join(",");return s.prepare(`
    SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title,
           started_at, started_at_epoch, completed_at, completed_at_epoch, status
    FROM sdk_sessions
    WHERE memory_session_id IN (${t})
    ORDER BY started_at_epoch DESC
  `).all(...e)}function Fe(s,e,t=3){return s.prepare(`
    SELECT * FROM (
      SELECT
        s.memory_session_id,
        s.status,
        s.started_at,
        s.started_at_epoch,
        s.user_prompt,
        CASE WHEN sum.memory_session_id IS NOT NULL THEN 1 ELSE 0 END as has_summary
      FROM sdk_sessions s
      LEFT JOIN session_summaries sum ON s.memory_session_id = sum.memory_session_id
      WHERE s.project = ? AND s.memory_session_id IS NOT NULL
      GROUP BY s.memory_session_id
      ORDER BY s.started_at_epoch DESC
      LIMIT ?
    )
    ORDER BY started_at_epoch ASC
  `).all(e,t)}function je(s,e){return s.prepare(`
    SELECT
      id,
      memory_session_id,
      content_session_id,
      project,
      user_prompt,
      request_summary,
      learned_summary,
      status,
      created_at,
      created_at_epoch
    FROM sdk_sessions
    WHERE id = ?
    LIMIT 1
  `).get(e)||null}function Xe(s,e,t,r){let n=new Date,o=n.getTime();return s.prepare(`
    INSERT INTO user_prompts
    (content_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?)
  `).run(e,t,r,n.toISOString(),o).lastInsertRowid}function Be(s,e,t){return s.prepare(`
    SELECT prompt_text
    FROM user_prompts
    WHERE content_session_id = ? AND prompt_number = ?
    LIMIT 1
  `).get(e,t)?.prompt_text??null}function Ge(s,e){return s.prepare(`
    SELECT COUNT(*) as count FROM user_prompts WHERE content_session_id = ?
  `).get(e).count}function He(s,e){return s.prepare(`
    SELECT
      up.*,
      s.memory_session_id,
      s.project
    FROM user_prompts up
    JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    WHERE up.content_session_id = ?
    ORDER BY up.created_at_epoch DESC
    LIMIT 1
  `).get(e)}function We(s,e=100){return s.prepare(`
    SELECT
      up.id,
      up.content_session_id,
      s.project,
      up.prompt_number,
      up.prompt_text,
      up.created_at,
      up.created_at_epoch
    FROM user_prompts up
    LEFT JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    ORDER BY up.created_at_epoch DESC
    LIMIT ?
  `).all(e)}function qe(s,e){return s.prepare(`
    SELECT
      p.id,
      p.content_session_id,
      p.prompt_number,
      p.prompt_text,
      s.project,
      p.created_at,
      p.created_at_epoch
    FROM user_prompts p
    LEFT JOIN sdk_sessions s ON p.content_session_id = s.content_session_id
    WHERE p.id = ?
    LIMIT 1
  `).get(e)||null}function Ye(s,e){if(e.length===0)return[];let t=e.map(()=>"?").join(",");return s.prepare(`
    SELECT
      p.id,
      p.content_session_id,
      p.prompt_number,
      p.prompt_text,
      s.project,
      p.created_at,
      p.created_at_epoch
    FROM user_prompts p
    LEFT JOIN sdk_sessions s ON p.content_session_id = s.content_session_id
    WHERE p.id IN (${t})
    ORDER BY p.created_at_epoch DESC
  `).all(...e)}function Ve(s,e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o}=t,i=r==="date_asc"?"ASC":"DESC",a=n?`LIMIT ${n}`:"",m=e.map(()=>"?").join(","),u=[...e],l=o?"AND s.project = ?":"";return o&&u.push(o),s.prepare(`
    SELECT
      up.*,
      s.project,
      s.memory_session_id
    FROM user_prompts up
    JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    WHERE up.id IN (${m}) ${l}
    ORDER BY up.created_at_epoch ${i}
    ${a}
  `).all(...u)}function Ke(s,e,t=10,r=10,n){return Q(s,null,e,t,r,n)}function Q(s,e,t,r=10,n=10,o){let i=o?"AND project = ?":"",a=o?[o]:[],m,u;if(e!==null){let c=`
      SELECT id, created_at_epoch
      FROM observations
      WHERE id <= ? ${i}
      ORDER BY id DESC
      LIMIT ?
    `,b=`
      SELECT id, created_at_epoch
      FROM observations
      WHERE id >= ? ${i}
      ORDER BY id ASC
      LIMIT ?
    `;try{let S=s.prepare(c).all(e,...a,r+1),O=s.prepare(b).all(e,...a,n+1);if(S.length===0&&O.length===0)return{observations:[],sessions:[],prompts:[]};m=S.length>0?S[S.length-1].created_at_epoch:t,u=O.length>0?O[O.length-1].created_at_epoch:t}catch(S){return p.error("DB","Error getting boundary observations",void 0,{error:S,project:o}),{observations:[],sessions:[],prompts:[]}}}else{let c=`
      SELECT created_at_epoch
      FROM observations
      WHERE created_at_epoch <= ? ${i}
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `,b=`
      SELECT created_at_epoch
      FROM observations
      WHERE created_at_epoch >= ? ${i}
      ORDER BY created_at_epoch ASC
      LIMIT ?
    `;try{let S=s.prepare(c).all(t,...a,r),O=s.prepare(b).all(t,...a,n+1);if(S.length===0&&O.length===0)return{observations:[],sessions:[],prompts:[]};m=S.length>0?S[S.length-1].created_at_epoch:t,u=O.length>0?O[O.length-1].created_at_epoch:t}catch(S){return p.error("DB","Error getting boundary timestamps",void 0,{error:S,project:o}),{observations:[],sessions:[],prompts:[]}}}let l=`
    SELECT *
    FROM observations
    WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${i}
    ORDER BY created_at_epoch ASC
  `,_=`
    SELECT *
    FROM session_summaries
    WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${i}
    ORDER BY created_at_epoch ASC
  `,E=`
    SELECT up.*, s.project, s.memory_session_id
    FROM user_prompts up
    JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    WHERE up.created_at_epoch >= ? AND up.created_at_epoch <= ? ${i.replace("project","s.project")}
    ORDER BY up.created_at_epoch ASC
  `,g=s.prepare(l).all(m,u,...a),f=s.prepare(_).all(m,u,...a),R=s.prepare(E).all(m,u,...a);return{observations:g,sessions:f.map(c=>({id:c.id,memory_session_id:c.memory_session_id,project:c.project,request:c.request,completed:c.completed,next_steps:c.next_steps,created_at:c.created_at,created_at_epoch:c.created_at_epoch})),prompts:R.map(c=>({id:c.id,content_session_id:c.content_session_id,prompt_number:c.prompt_number,prompt_text:c.prompt_text,project:c.project,created_at:c.created_at,created_at_epoch:c.created_at_epoch}))}}function Je(s){return s.prepare(`
    SELECT DISTINCT project
    FROM sdk_sessions
    WHERE project IS NOT NULL AND project != ''
    ORDER BY project ASC
  `).all().map(r=>r.project)}function Qe(s,e,t,r,n,o,i,a=0,m){let u=m??Date.now(),l=new Date(u).toISOString();return s.transaction(()=>{let E=[],g=s.prepare(`
      INSERT INTO observations
      (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
       files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);for(let c of r){let b=P(e,c.title,c.narrative),S=$(s,b,u);if(S){E.push(S.id);continue}let O=g.run(e,t,c.type,c.title,c.subtitle,JSON.stringify(c.facts),c.narrative,JSON.stringify(c.concepts),JSON.stringify(c.files_read),JSON.stringify(c.files_modified),i||null,a,b,l,u);E.push(Number(O.lastInsertRowid))}let f=null;if(n){let b=s.prepare(`
        INSERT INTO session_summaries
        (memory_session_id, project, request, investigated, learned, completed,
         next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(e,t,n.request,n.investigated,n.learned,n.completed,n.next_steps,n.notes,i||null,a,l,u);f=Number(b.lastInsertRowid)}return s.prepare(`
      UPDATE pending_messages
      SET
        status = 'processed',
        completed_at_epoch = ?,
        tool_input = NULL,
        tool_response = NULL
      WHERE id = ? AND status = 'processing'
    `).run(u,o),{observationIds:E,summaryId:f,createdAtEpoch:u}})()}function ze(s,e,t,r,n,o,i=0,a){let m=a??Date.now(),u=new Date(m).toISOString();return s.transaction(()=>{let _=[],E=s.prepare(`
      INSERT INTO observations
      (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
       files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);for(let f of r){let R=P(e,f.title,f.narrative),c=$(s,R,m);if(c){_.push(c.id);continue}let b=E.run(e,t,f.type,f.title,f.subtitle,JSON.stringify(f.facts),f.narrative,JSON.stringify(f.concepts),JSON.stringify(f.files_read),JSON.stringify(f.files_modified),o||null,i,R,u,m);_.push(Number(b.lastInsertRowid))}let g=null;if(n){let R=s.prepare(`
        INSERT INTO session_summaries
        (memory_session_id, project, request, investigated, learned, completed,
         next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(e,t,n.request,n.investigated,n.learned,n.completed,n.next_steps,n.notes,o||null,i,u,m);g=Number(R.lastInsertRowid)}return{observationIds:_,summaryId:g,createdAtEpoch:m}})()}function Ze(s,e){let t=s.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(e.content_session_id);return t?{imported:!1,id:t.id}:{imported:!0,id:s.prepare(`
    INSERT INTO sdk_sessions (
      content_session_id, memory_session_id, project, user_prompt,
      started_at, started_at_epoch, completed_at, completed_at_epoch, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e.content_session_id,e.memory_session_id,e.project,e.user_prompt,e.started_at,e.started_at_epoch,e.completed_at,e.completed_at_epoch,e.status).lastInsertRowid}}function et(s,e){let t=s.prepare("SELECT id FROM session_summaries WHERE memory_session_id = ?").get(e.memory_session_id);return t?{imported:!1,id:t.id}:{imported:!0,id:s.prepare(`
    INSERT INTO session_summaries (
      memory_session_id, project, request, investigated, learned,
      completed, next_steps, files_read, files_edited, notes,
      prompt_number, discovery_tokens, created_at, created_at_epoch
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e.memory_session_id,e.project,e.request,e.investigated,e.learned,e.completed,e.next_steps,e.files_read,e.files_edited,e.notes,e.prompt_number,e.discovery_tokens||0,e.created_at,e.created_at_epoch).lastInsertRowid}}function tt(s,e){let t=s.prepare(`
      SELECT id FROM observations
      WHERE memory_session_id = ? AND title = ? AND created_at_epoch = ?
    `).get(e.memory_session_id,e.title,e.created_at_epoch);return t?{imported:!1,id:t.id}:{imported:!0,id:s.prepare(`
    INSERT INTO observations (
      memory_session_id, project, text, type, title, subtitle,
      facts, narrative, concepts, files_read, files_modified,
      prompt_number, discovery_tokens, created_at, created_at_epoch
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e.memory_session_id,e.project,e.text,e.type,e.title,e.subtitle,e.facts,e.narrative,e.concepts,e.files_read,e.files_modified,e.prompt_number,e.discovery_tokens||0,e.created_at,e.created_at_epoch).lastInsertRowid}}function st(s,e){let t=s.prepare(`
      SELECT id FROM user_prompts
      WHERE content_session_id = ? AND prompt_number = ?
    `).get(e.content_session_id,e.prompt_number);return t?{imported:!1,id:t.id}:{imported:!0,id:s.prepare(`
    INSERT INTO user_prompts (
      content_session_id, prompt_number, prompt_text,
      created_at, created_at_epoch
    ) VALUES (?, ?, ?, ?, ?)
  `).run(e.content_session_id,e.prompt_number,e.prompt_text,e.created_at,e.created_at_epoch).lastInsertRowid}}var F=class{db;constructor(e=Ee){e!==":memory:"&&ge(I),this.db=new rt.Database(e),this.db.run("PRAGMA journal_mode = WAL"),this.db.run("PRAGMA synchronous = NORMAL"),this.db.run("PRAGMA foreign_keys = ON"),new w(this.db).runAllMigrations()}updateMemorySessionId(e,t){return we(this.db,e,t)}ensureMemorySessionIdRegistered(e,t){return Ue(this.db,e,t)}createSDKSession(e,t,r,n){return xe(this.db,e,t,r,n)}getSessionById(e){return Pe(this.db,e)}getSdkSessionsBySessionIds(e){return $e(this.db,e)}getRecentSessionsWithStatus(e,t=3){return Fe(this.db,e,t)}getOrCreateManualSession(e){return ke(this.db,e)}getSessionSummaryById(e){return je(this.db,e)}getRecentObservations(e,t=20){return Ie(this.db,e,t)}getAllRecentObservations(e=100){return ye(this.db,e)}getObservationsForSession(e){return Re(this.db,e)}getObservationById(e){return he(this.db,e)}getObservationsByIds(e,t={}){return Oe(this.db,e,t)}getFilesForSession(e){return Ce(this.db,e)}storeObservation(e,t,r,n,o=0,i){return be(this.db,e,t,r,n,o,i)}getRecentSummaries(e,t=10){return De(this.db,e,t)}getRecentSummariesWithSessionInfo(e,t=3){return Me(this.db,e,t)}getAllRecentSummaries(e=50){return Le(this.db,e)}getSummaryForSession(e){return Ne(this.db,e)}getSessionSummariesByIds(e,t={}){return ve(this.db,e,t)}storeSummary(e,t,r,n,o=0,i){return Ae(this.db,e,t,r,n,o,i)}getAllRecentUserPrompts(e=100){return We(this.db,e)}getLatestUserPrompt(e){return He(this.db,e)}getPromptNumberFromUserPrompts(e){return Ge(this.db,e)}saveUserPrompt(e,t,r){return Xe(this.db,e,t,r)}getUserPrompt(e,t){return Be(this.db,e,t)}getPromptById(e){return qe(this.db,e)}getPromptsByIds(e){return Ye(this.db,e)}getUserPromptsByIds(e,t={}){return Ve(this.db,e,t)}getAllProjects(){return Je(this.db)}getTimelineAroundTimestamp(e,t=10,r=10,n){return Ke(this.db,e,t,r,n)}getTimelineAroundObservation(e,t,r=10,n=10,o){return Q(this.db,e,t,r,n,o)}storeObservations(e,t,r,n,o,i=0,a){return ze(this.db,e,t,r,n,o,i,a)}storeObservationsAndMarkComplete(e,t,r,n,o,i,a,m=0,u){return Qe(this.db,e,t,r,n,o,a,m,u)}importSdkSession(e){return Ze(this.db,e)}importSessionSummary(e){return et(this.db,e)}importObservation(e){return tt(this.db,e)}importUserPrompt(e){return st(this.db,e)}close(){this.db.close()}};var nt=N(require("path"),1);function ot(s){if(!s||s.trim()==="")return p.warn("PROJECT_NAME","Empty cwd provided, using fallback",{cwd:s}),"unknown-project";let e=nt.default.basename(s);if(e===""){if(process.platform==="win32"){let r=s.match(/^([A-Z]):\\/i);if(r){let o=`drive-${r[1].toUpperCase()}`;return p.info("PROJECT_NAME","Drive root detected",{cwd:s,projectName:o}),o}}return p.warn("PROJECT_NAME","Root directory detected, using fallback",{cwd:s}),"unknown-project"}return e}var at=N(require("path"),1),mt=require("os");var y=require("fs"),X=require("path"),it=require("os"),j=class{static DEFAULTS={CLAUDE_MEM_MODEL:"claude-sonnet-4-5",CLAUDE_MEM_CONTEXT_OBSERVATIONS:"50",CLAUDE_MEM_WORKER_PORT:"37777",CLAUDE_MEM_WORKER_HOST:"127.0.0.1",CLAUDE_MEM_SKIP_TOOLS:"ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion",CLAUDE_MEM_PROVIDER:"claude",CLAUDE_MEM_CLAUDE_AUTH_METHOD:"cli",CLAUDE_MEM_GEMINI_API_KEY:"",CLAUDE_MEM_GEMINI_MODEL:"gemini-2.5-flash-lite",CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED:"true",CLAUDE_MEM_OPENROUTER_API_KEY:"",CLAUDE_MEM_OPENROUTER_MODEL:"xiaomi/mimo-v2-flash:free",CLAUDE_MEM_OPENROUTER_SITE_URL:"",CLAUDE_MEM_OPENROUTER_APP_NAME:"claude-mem",CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES:"20",CLAUDE_MEM_OPENROUTER_MAX_TOKENS:"100000",CLAUDE_MEM_DATA_DIR:(0,X.join)((0,it.homedir)(),".claude-mem"),CLAUDE_MEM_LOG_LEVEL:"INFO",CLAUDE_MEM_PYTHON_VERSION:"3.13",CLAUDE_CODE_PATH:"",CLAUDE_MEM_MODE:"code",CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS:"false",CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS:"false",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT:"false",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT:"true",CLAUDE_MEM_CONTEXT_FULL_COUNT:"0",CLAUDE_MEM_CONTEXT_FULL_FIELD:"narrative",CLAUDE_MEM_CONTEXT_SESSION_COUNT:"10",CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY:"true",CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE:"false",CLAUDE_MEM_CONTEXT_SHOW_TERMINAL_OUTPUT:"true",CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED:"false",CLAUDE_MEM_MAX_CONCURRENT_AGENTS:"2",CLAUDE_MEM_EXCLUDED_PROJECTS:"",CLAUDE_MEM_FOLDER_MD_EXCLUDE:"[]",CLAUDE_MEM_CHROMA_ENABLED:"true",CLAUDE_MEM_CHROMA_MODE:"local",CLAUDE_MEM_CHROMA_HOST:"127.0.0.1",CLAUDE_MEM_CHROMA_PORT:"8000",CLAUDE_MEM_CHROMA_SSL:"false",CLAUDE_MEM_CHROMA_API_KEY:"",CLAUDE_MEM_CHROMA_TENANT:"default_tenant",CLAUDE_MEM_CHROMA_DATABASE:"default_database"};static getAllDefaults(){return{...this.DEFAULTS}}static get(e){return process.env[e]??this.DEFAULTS[e]}static getInt(e){let t=this.get(e);return parseInt(t,10)}static getBool(e){return this.get(e)==="true"}static applyEnvOverrides(e){let t={...e};for(let r of Object.keys(this.DEFAULTS))process.env[r]!==void 0&&(t[r]=process.env[r]);return t}static loadFromFile(e){try{if(!(0,y.existsSync)(e)){let i=this.getAllDefaults();try{let a=(0,X.dirname)(e);(0,y.existsSync)(a)||(0,y.mkdirSync)(a,{recursive:!0}),(0,y.writeFileSync)(e,JSON.stringify(i,null,2),"utf-8"),console.log("[SETTINGS] Created settings file with defaults:",e)}catch(a){console.warn("[SETTINGS] Failed to create settings file, using in-memory defaults:",e,a)}return this.applyEnvOverrides(i)}let t=(0,y.readFileSync)(e,"utf-8"),r=JSON.parse(t),n=r;if(r.env&&typeof r.env=="object"){n=r.env;try{(0,y.writeFileSync)(e,JSON.stringify(n,null,2),"utf-8"),console.log("[SETTINGS] Migrated settings file from nested to flat schema:",e)}catch(i){console.warn("[SETTINGS] Failed to auto-migrate settings file:",e,i)}}let o={...this.DEFAULTS};for(let i of Object.keys(this.DEFAULTS))n[i]!==void 0&&(o[i]=n[i]);return this.applyEnvOverrides(o)}catch(t){return console.warn("[SETTINGS] Failed to load settings, using defaults:",e,t),this.applyEnvOverrides(this.getAllDefaults())}}};var D=require("fs"),B=require("path");var h=class s{static instance=null;activeMode=null;modesDir;constructor(){let e=fe(),t=[(0,B.join)(e,"modes"),(0,B.join)(e,"..","plugin","modes")],r=t.find(n=>(0,D.existsSync)(n));this.modesDir=r||t[0]}static getInstance(){return s.instance||(s.instance=new s),s.instance}parseInheritance(e){let t=e.split("--");if(t.length===1)return{hasParent:!1,parentId:"",overrideId:""};if(t.length>2)throw new Error(`Invalid mode inheritance: ${e}. Only one level of inheritance supported (parent--override)`);return{hasParent:!0,parentId:t[0],overrideId:e}}isPlainObject(e){return e!==null&&typeof e=="object"&&!Array.isArray(e)}deepMerge(e,t){let r={...e};for(let n in t){let o=t[n],i=e[n];this.isPlainObject(o)&&this.isPlainObject(i)?r[n]=this.deepMerge(i,o):r[n]=o}return r}loadModeFile(e){let t=(0,B.join)(this.modesDir,`${e}.json`);if(!(0,D.existsSync)(t))throw new Error(`Mode file not found: ${t}`);let r=(0,D.readFileSync)(t,"utf-8");return JSON.parse(r)}loadMode(e){let t=this.parseInheritance(e);if(!t.hasParent)try{let m=this.loadModeFile(e);return this.activeMode=m,p.debug("SYSTEM",`Loaded mode: ${m.name} (${e})`,void 0,{types:m.observation_types.map(u=>u.id),concepts:m.observation_concepts.map(u=>u.id)}),m}catch{if(p.warn("SYSTEM",`Mode file not found: ${e}, falling back to 'code'`),e==="code")throw new Error("Critical: code.json mode file missing");return this.loadMode("code")}let{parentId:r,overrideId:n}=t,o;try{o=this.loadMode(r)}catch{p.warn("SYSTEM",`Parent mode '${r}' not found for ${e}, falling back to 'code'`),o=this.loadMode("code")}let i;try{i=this.loadModeFile(n),p.debug("SYSTEM",`Loaded override file: ${n} for parent ${r}`)}catch{return p.warn("SYSTEM",`Override file '${n}' not found, using parent mode '${r}' only`),this.activeMode=o,o}if(!i)return p.warn("SYSTEM",`Invalid override file: ${n}, using parent mode '${r}' only`),this.activeMode=o,o;let a=this.deepMerge(o,i);return this.activeMode=a,p.debug("SYSTEM",`Loaded mode with inheritance: ${a.name} (${e} = ${r} + ${n})`,void 0,{parent:r,override:n,types:a.observation_types.map(m=>m.id),concepts:a.observation_concepts.map(m=>m.id)}),a}getActiveMode(){if(!this.activeMode)throw new Error("No mode loaded. Call loadMode() first.");return this.activeMode}getObservationTypes(){return this.getActiveMode().observation_types}getObservationConcepts(){return this.getActiveMode().observation_concepts}getTypeIcon(e){return this.getObservationTypes().find(r=>r.id===e)?.emoji||"\u{1F4DD}"}getWorkEmoji(e){return this.getObservationTypes().find(r=>r.id===e)?.work_emoji||"\u{1F4DD}"}validateType(e){return this.getObservationTypes().some(t=>t.id===e)}getTypeLabel(e){return this.getObservationTypes().find(r=>r.id===e)?.label||e}};function z(){let s=at.default.join((0,mt.homedir)(),".claude-mem","settings.json"),e=j.loadFromFile(s),t=h.getInstance().getActiveMode(),r=new Set(t.observation_types.map(o=>o.id)),n=new Set(t.observation_concepts.map(o=>o.id));return{totalObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_OBSERVATIONS,10),fullObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_FULL_COUNT,10),sessionCount:parseInt(e.CLAUDE_MEM_CONTEXT_SESSION_COUNT,10),showReadTokens:e.CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS==="true",showWorkTokens:e.CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS==="true",showSavingsAmount:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT==="true",showSavingsPercent:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT==="true",observationTypes:r,observationConcepts:n,fullObservationField:e.CLAUDE_MEM_CONTEXT_FULL_FIELD,showLastSummary:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY==="true",showLastMessage:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE==="true"}}var d={reset:"\x1B[0m",bright:"\x1B[1m",dim:"\x1B[2m",cyan:"\x1B[36m",green:"\x1B[32m",yellow:"\x1B[33m",blue:"\x1B[34m",magenta:"\x1B[35m",gray:"\x1B[90m",red:"\x1B[31m"},dt=4,Z=1;function ee(s){let e=(s.title?.length||0)+(s.subtitle?.length||0)+(s.narrative?.length||0)+JSON.stringify(s.facts||[]).length;return Math.ceil(e/dt)}function te(s){let e=s.length,t=s.reduce((i,a)=>i+ee(a),0),r=s.reduce((i,a)=>i+(a.discovery_tokens||0),0),n=r-t,o=r>0?Math.round(n/r*100):0;return{totalObservations:e,totalReadTokens:t,totalDiscoveryTokens:r,savings:n,savingsPercent:o}}function _s(s){return h.getInstance().getWorkEmoji(s)}function M(s,e){let t=ee(s),r=s.discovery_tokens||0,n=_s(s.type),o=r>0?`${n} ${r.toLocaleString()}`:"-";return{readTokens:t,discoveryTokens:r,discoveryDisplay:o,workEmoji:n}}function G(s){return s.showReadTokens||s.showWorkTokens||s.showSavingsAmount||s.showSavingsPercent}var ut=N(require("path"),1),H=require("fs");function se(s,e,t){let r=Array.from(t.observationTypes),n=r.map(()=>"?").join(","),o=Array.from(t.observationConcepts),i=o.map(()=>"?").join(",");return s.db.prepare(`
    SELECT
      id, memory_session_id, type, title, subtitle, narrative,
      facts, concepts, files_read, files_modified, discovery_tokens,
      created_at, created_at_epoch
    FROM observations
    WHERE project = ?
      AND type IN (${n})
      AND EXISTS (
        SELECT 1 FROM json_each(concepts)
        WHERE value IN (${i})
      )
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,...r,...o,t.totalObservationCount)}function re(s,e,t){return s.db.prepare(`
    SELECT id, memory_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,t.sessionCount+Z)}function pt(s,e,t){let r=Array.from(t.observationTypes),n=r.map(()=>"?").join(","),o=Array.from(t.observationConcepts),i=o.map(()=>"?").join(","),a=e.map(()=>"?").join(",");return s.db.prepare(`
    SELECT
      id, memory_session_id, type, title, subtitle, narrative,
      facts, concepts, files_read, files_modified, discovery_tokens,
      created_at, created_at_epoch, project
    FROM observations
    WHERE project IN (${a})
      AND type IN (${n})
      AND EXISTS (
        SELECT 1 FROM json_each(concepts)
        WHERE value IN (${i})
      )
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(...e,...r,...o,t.totalObservationCount)}function lt(s,e,t){let r=e.map(()=>"?").join(",");return s.db.prepare(`
    SELECT id, memory_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch, project
    FROM session_summaries
    WHERE project IN (${r})
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(...e,t.sessionCount+Z)}function Es(s){return s.replace(/\//g,"-")}function gs(s){try{if(!(0,H.existsSync)(s))return{userMessage:"",assistantMessage:""};let e=(0,H.readFileSync)(s,"utf-8").trim();if(!e)return{userMessage:"",assistantMessage:""};let t=e.split(`
`).filter(n=>n.trim()),r="";for(let n=t.length-1;n>=0;n--)try{let o=t[n];if(!o.includes('"type":"assistant"'))continue;let i=JSON.parse(o);if(i.type==="assistant"&&i.message?.content&&Array.isArray(i.message.content)){let a="";for(let m of i.message.content)m.type==="text"&&(a+=m.text);if(a=a.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").trim(),a){r=a;break}}}catch(o){p.debug("PARSER","Skipping malformed transcript line",{lineIndex:n},o);continue}return{userMessage:"",assistantMessage:r}}catch(e){return p.failure("WORKER","Failed to extract prior messages from transcript",{transcriptPath:s},e),{userMessage:"",assistantMessage:""}}}function ne(s,e,t,r){if(!e.showLastMessage||s.length===0)return{userMessage:"",assistantMessage:""};let n=s.find(m=>m.memory_session_id!==t);if(!n)return{userMessage:"",assistantMessage:""};let o=n.memory_session_id,i=Es(r),a=ut.default.join(A,"projects",i,`${o}.jsonl`);return gs(a)}function ct(s,e){let t=e[0]?.id;return s.map((r,n)=>{let o=n===0?null:e[n+1];return{...r,displayEpoch:o?o.created_at_epoch:r.created_at_epoch,displayTime:o?o.created_at:r.created_at,shouldShowLink:r.id!==t}})}function oe(s,e){let t=[...s.map(r=>({type:"observation",data:r})),...e.map(r=>({type:"summary",data:r}))];return t.sort((r,n)=>{let o=r.type==="observation"?r.data.created_at_epoch:r.data.displayEpoch,i=n.type==="observation"?n.data.created_at_epoch:n.data.displayEpoch;return o-i}),t}function _t(s,e){return new Set(s.slice(0,e).map(t=>t.id))}function Et(){let s=new Date,e=s.toLocaleDateString("en-CA"),t=s.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}).toLowerCase().replace(" ",""),r=s.toLocaleTimeString("en-US",{timeZoneName:"short"}).split(" ").pop();return`${e} ${t} ${r}`}function gt(s){return[`# $CMEM ${s} ${Et()}`,""]}function Tt(){return[`Legend: \u{1F3AF}session ${h.getInstance().getActiveMode().observation_types.map(t=>`${t.emoji}${t.id}`).join(" ")}`,"Format: ID TIME TYPE TITLE","Fetch details: get_observations([IDs]) | Search: mem-search skill",""]}function ft(){return[]}function St(){return[]}function bt(s,e){let t=[],r=[`${s.totalObservations} obs (${s.totalReadTokens.toLocaleString()}t read)`,`${s.totalDiscoveryTokens.toLocaleString()}t work`];return s.totalDiscoveryTokens>0&&(e.showSavingsAmount||e.showSavingsPercent)&&(e.showSavingsPercent?r.push(`${s.savingsPercent}% savings`):e.showSavingsAmount&&r.push(`${s.savings.toLocaleString()}t saved`)),t.push(`Stats: ${r.join(" | ")}`),t.push(""),t}function ht(s){return[`### ${s}`]}function Ot(s){return s.toLowerCase().replace(" am","a").replace(" pm","p")}function Rt(s,e,t){let r=s.title||"Untitled",n=h.getInstance().getTypeIcon(s.type),o=e?Ot(e):'"';return`${s.id} ${o} ${n} ${r}`}function It(s,e,t,r){let n=[],o=s.title||"Untitled",i=h.getInstance().getTypeIcon(s.type),a=e?Ot(e):'"',{readTokens:m,discoveryDisplay:u}=M(s,r);n.push(`**${s.id}** ${a} ${i} **${o}**`),t&&n.push(t);let l=[];return r.showReadTokens&&l.push(`~${m}t`),r.showWorkTokens&&l.push(u),l.length>0&&n.push(l.join(" ")),n.push(""),n}function yt(s,e){return[`S${s.id} ${s.request||"Session started"} (${e})`]}function L(s,e){return e?[`**${s}**: ${e}`,""]:[]}function Ct(s){return s.assistantMessage?["","---","","**Previously**","",`A: ${s.assistantMessage}`,""]:[]}function At(s,e){return["",`Access ${Math.round(s/1e3)}k tokens of past work via get_observations([IDs]) or mem-search skill.`]}function Nt(s){return`# $CMEM ${s} ${Et()}

No previous sessions found.`}function vt(){let s=new Date,e=s.toLocaleDateString("en-CA"),t=s.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}).toLowerCase().replace(" ",""),r=s.toLocaleTimeString("en-US",{timeZoneName:"short"}).split(" ").pop();return`${e} ${t} ${r}`}function Dt(s){return["",`${d.bright}${d.cyan}[${s}] recent context, ${vt()}${d.reset}`,`${d.gray}${"\u2500".repeat(60)}${d.reset}`,""]}function Mt(){let e=h.getInstance().getActiveMode().observation_types.map(t=>`${t.emoji} ${t.id}`).join(" | ");return[`${d.dim}Legend: session-request | ${e}${d.reset}`,""]}function Lt(){return[`${d.bright}Column Key${d.reset}`,`${d.dim}  Read: Tokens to read this observation (cost to learn it now)${d.reset}`,`${d.dim}  Work: Tokens spent on work that produced this record ( research, building, deciding)${d.reset}`,""]}function xt(){return[`${d.dim}Context Index: This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.${d.reset}`,"",`${d.dim}When you need implementation details, rationale, or debugging context:${d.reset}`,`${d.dim}  - Fetch by ID: get_observations([IDs]) for observations visible in this index${d.reset}`,`${d.dim}  - Search history: Use the mem-search skill for past decisions, bugs, and deeper research${d.reset}`,`${d.dim}  - Trust this index over re-reading code for past decisions and learnings${d.reset}`,""]}function Ut(s,e){let t=[];if(t.push(`${d.bright}${d.cyan}Context Economics${d.reset}`),t.push(`${d.dim}  Loading: ${s.totalObservations} observations (${s.totalReadTokens.toLocaleString()} tokens to read)${d.reset}`),t.push(`${d.dim}  Work investment: ${s.totalDiscoveryTokens.toLocaleString()} tokens spent on research, building, and decisions${d.reset}`),s.totalDiscoveryTokens>0&&(e.showSavingsAmount||e.showSavingsPercent)){let r="  Your savings: ";e.showSavingsAmount&&e.showSavingsPercent?r+=`${s.savings.toLocaleString()} tokens (${s.savingsPercent}% reduction from reuse)`:e.showSavingsAmount?r+=`${s.savings.toLocaleString()} tokens`:r+=`${s.savingsPercent}% reduction from reuse`,t.push(`${d.green}${r}${d.reset}`)}return t.push(""),t}function kt(s){return[`${d.bright}${d.cyan}${s}${d.reset}`,""]}function wt(s){return[`${d.dim}${s}${d.reset}`]}function Pt(s,e,t,r){let n=s.title||"Untitled",o=h.getInstance().getTypeIcon(s.type),{readTokens:i,discoveryTokens:a,workEmoji:m}=M(s,r),u=t?`${d.dim}${e}${d.reset}`:" ".repeat(e.length),l=r.showReadTokens&&i>0?`${d.dim}(~${i}t)${d.reset}`:"",_=r.showWorkTokens&&a>0?`${d.dim}(${m} ${a.toLocaleString()}t)${d.reset}`:"";return`  ${d.dim}#${s.id}${d.reset}  ${u}  ${o}  ${n} ${l} ${_}`}function $t(s,e,t,r,n){let o=[],i=s.title||"Untitled",a=h.getInstance().getTypeIcon(s.type),{readTokens:m,discoveryTokens:u,workEmoji:l}=M(s,n),_=t?`${d.dim}${e}${d.reset}`:" ".repeat(e.length),E=n.showReadTokens&&m>0?`${d.dim}(~${m}t)${d.reset}`:"",g=n.showWorkTokens&&u>0?`${d.dim}(${l} ${u.toLocaleString()}t)${d.reset}`:"";return o.push(`  ${d.dim}#${s.id}${d.reset}  ${_}  ${a}  ${d.bright}${i}${d.reset}`),r&&o.push(`    ${d.dim}${r}${d.reset}`),(E||g)&&o.push(`    ${E} ${g}`),o.push(""),o}function Ft(s,e){let t=`${s.request||"Session started"} (${e})`;return[`${d.yellow}#S${s.id}${d.reset} ${t}`,""]}function x(s,e,t){return e?[`${t}${s}:${d.reset} ${e}`,""]:[]}function jt(s){return s.assistantMessage?["","---","",`${d.bright}${d.magenta}Previously${d.reset}`,"",`${d.dim}A: ${s.assistantMessage}${d.reset}`,""]:[]}function Xt(s,e){let t=Math.round(s/1e3);return["",`${d.dim}Access ${t}k tokens of past research & decisions for just ${e.toLocaleString()}t. Use the claude-mem skill to access memories by ID.${d.reset}`]}function Bt(s){return`
${d.bright}${d.cyan}[${s}] recent context, ${vt()}${d.reset}
${d.gray}${"\u2500".repeat(60)}${d.reset}

${d.dim}No previous sessions found for this project yet.${d.reset}
`}function Gt(s,e,t,r){let n=[];return r?n.push(...Dt(s)):n.push(...gt(s)),r?n.push(...Mt()):n.push(...Tt()),r?n.push(...Lt()):n.push(...ft()),r?n.push(...xt()):n.push(...St()),G(t)&&(r?n.push(...Ut(e,t)):n.push(...bt(e,t))),n}var ie=N(require("path"),1);function Y(s){if(!s)return[];try{let e=JSON.parse(s);return Array.isArray(e)?e:[]}catch(e){return p.debug("PARSER","Failed to parse JSON array, using empty fallback",{preview:s?.substring(0,50)},e),[]}}function ae(s){return new Date(s).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0})}function me(s){return new Date(s).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})}function Wt(s){return new Date(s).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}function Ht(s,e){return ie.default.isAbsolute(s)?ie.default.relative(e,s):s}function qt(s,e,t){let r=Y(s);if(r.length>0)return Ht(r[0],e);if(t){let n=Y(t);if(n.length>0)return Ht(n[0],e)}return"General"}function Ts(s){let e=new Map;for(let r of s){let n=r.type==="observation"?r.data.created_at:r.data.displayTime,o=Wt(n);e.has(o)||e.set(o,[]),e.get(o).push(r)}let t=Array.from(e.entries()).sort((r,n)=>{let o=new Date(r[0]).getTime(),i=new Date(n[0]).getTime();return o-i});return new Map(t)}function Yt(s,e){return e.fullObservationField==="narrative"?s.narrative:s.facts?Y(s.facts).join(`
`):null}function fs(s,e,t,r){let n=[];n.push(...ht(s));let o="";for(let i of e)if(i.type==="summary"){o="";let a=i.data,m=ae(a.displayTime);n.push(...yt(a,m))}else{let a=i.data,m=me(a.created_at),l=m!==o?m:"";if(o=m,t.has(a.id)){let E=Yt(a,r);n.push(...It(a,l,E,r))}else n.push(Rt(a,l,r))}return n}function Ss(s,e,t,r,n){let o=[];o.push(...kt(s));let i=null,a="";for(let m of e)if(m.type==="summary"){i=null,a="";let u=m.data,l=ae(u.displayTime);o.push(...Ft(u,l))}else{let u=m.data,l=qt(u.files_modified,n,u.files_read),_=me(u.created_at),E=_!==a;a=_;let g=t.has(u.id);if(l!==i&&(o.push(...wt(l)),i=l),g){let f=Yt(u,r);o.push(...$t(u,_,E,f,r))}else o.push(Pt(u,_,E,r))}return o.push(""),o}function bs(s,e,t,r,n,o){return o?Ss(s,e,t,r,n):fs(s,e,t,r)}function Vt(s,e,t,r,n){let o=[],i=Ts(s);for(let[a,m]of i)o.push(...bs(a,m,e,t,r,n));return o}function Kt(s,e,t){return!(!s.showLastSummary||!e||!!!(e.investigated||e.learned||e.completed||e.next_steps)||t&&e.created_at_epoch<=t.created_at_epoch)}function Jt(s,e){let t=[];return e?(t.push(...x("Investigated",s.investigated,d.blue)),t.push(...x("Learned",s.learned,d.yellow)),t.push(...x("Completed",s.completed,d.green)),t.push(...x("Next Steps",s.next_steps,d.magenta))):(t.push(...L("Investigated",s.investigated)),t.push(...L("Learned",s.learned)),t.push(...L("Completed",s.completed)),t.push(...L("Next Steps",s.next_steps))),t}function Qt(s,e){return e?jt(s):Ct(s)}function zt(s,e,t){return!G(e)||s.totalDiscoveryTokens<=0||s.savings<=0?[]:t?Xt(s.totalDiscoveryTokens,s.totalReadTokens):At(s.totalDiscoveryTokens,s.totalReadTokens)}var hs=Zt.default.join((0,es.homedir)(),".claude","plugins","marketplaces","thedotmack","plugin",".install-version");function Os(){try{return new F}catch(s){if(s.code==="ERR_DLOPEN_FAILED"){try{(0,ts.unlinkSync)(hs)}catch(e){p.debug("SYSTEM","Marker file cleanup failed (may not exist)",{},e)}return p.error("SYSTEM","Native module rebuild needed - restart Claude Code to auto-fix"),null}throw s}}function Rs(s,e){return e?Bt(s):Nt(s)}function Is(s,e,t,r,n,o,i){let a=[],m=te(e);a.push(...Gt(s,m,r,i));let u=t.slice(0,r.sessionCount),l=ct(u,t),_=oe(e,l),E=_t(e,r.fullObservationCount);a.push(...Vt(_,E,r,n,i));let g=t[0],f=e[0];Kt(r,g,f)&&a.push(...Jt(g,i));let R=ne(e,r,o,n);return a.push(...Qt(R,i)),a.push(...zt(m,r,i)),a.join(`
`).trimEnd()}async function de(s,e=!1){let t=z(),r=s?.cwd??process.cwd(),n=ot(r),o=s?.projects||[n];s?.full&&(t.totalObservationCount=999999,t.sessionCount=999999);let i=Os();if(!i)return"";try{let a=o.length>1?pt(i,o,t):se(i,n,t),m=o.length>1?lt(i,o,t):re(i,n,t);return a.length===0&&m.length===0?Rs(n,e):Is(n,a,m,t,r,s?.session_id,e)}finally{i.close()}}0&&(module.exports={generateContext});
