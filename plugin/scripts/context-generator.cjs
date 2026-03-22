"use strict";var ss=Object.create;var U=Object.defineProperty;var rs=Object.getOwnPropertyDescriptor;var ns=Object.getOwnPropertyNames;var os=Object.getPrototypeOf,is=Object.prototype.hasOwnProperty;var as=(s,e)=>{for(var t in e)U(s,t,{get:e[t],enumerable:!0})},pe=(s,e,t,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of ns(e))!is.call(s,n)&&n!==t&&U(s,n,{get:()=>e[n],enumerable:!(r=rs(e,n))||r.enumerable});return s};var y=(s,e,t)=>(t=s!=null?ss(os(s)):{},pe(e||!s||!s.__esModule?U(t,"default",{value:s,enumerable:!0}):t,s)),ms=s=>pe(U({},"__esModule",{value:!0}),s);var Cs={};as(Cs,{generateContext:()=>de});module.exports=ms(Cs);var Zt=y(require("path"),1),es=require("os"),ts=require("fs");var rt=require("bun:sqlite");var T=require("path"),J=require("os"),k=require("fs"),le=require("child_process"),_e=require("url");var N=require("fs"),v=require("path"),ce=require("os"),V=(o=>(o[o.DEBUG=0]="DEBUG",o[o.INFO=1]="INFO",o[o.WARN=2]="WARN",o[o.ERROR=3]="ERROR",o[o.SILENT=4]="SILENT",o))(V||{}),ue=(0,v.join)((0,ce.homedir)(),".claude-mem"),K=class{level=null;useColor;logFilePath=null;logFileInitialized=!1;constructor(){this.useColor=process.stdout.isTTY??!1}ensureLogFileInitialized(){if(!this.logFileInitialized){this.logFileInitialized=!0;try{let e=(0,v.join)(ue,"logs");(0,N.existsSync)(e)||(0,N.mkdirSync)(e,{recursive:!0});let t=new Date().toISOString().split("T")[0];this.logFilePath=(0,v.join)(e,`claude-mem-${t}.log`)}catch(e){console.error("[LOGGER] Failed to initialize log file:",e),this.logFilePath=null}}}getLevel(){if(this.level===null)try{let e=(0,v.join)(ue,"settings.json");if((0,N.existsSync)(e)){let t=(0,N.readFileSync)(e,"utf-8"),n=(JSON.parse(t).CLAUDE_MEM_LOG_LEVEL||"INFO").toUpperCase();this.level=V[n]??1}else this.level=1}catch{this.level=1}return this.level}correlationId(e,t){return`obs-${e}-${t}`}sessionId(e){return`session-${e}`}formatData(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return e.toString();if(typeof e=="object"){if(e instanceof Error)return this.getLevel()===0?`${e.message}
${e.stack}`:e.message;if(Array.isArray(e))return`[${e.length} items]`;let t=Object.keys(e);return t.length===0?"{}":t.length<=3?JSON.stringify(e):`{${t.length} keys: ${t.slice(0,3).join(", ")}...}`}return String(e)}formatTool(e,t){if(!t)return e;let r=t;if(typeof t=="string")try{r=JSON.parse(t)}catch{r=t}if(e==="Bash"&&r.command)return`${e}(${r.command})`;if(r.file_path)return`${e}(${r.file_path})`;if(r.notebook_path)return`${e}(${r.notebook_path})`;if(e==="Glob"&&r.pattern)return`${e}(${r.pattern})`;if(e==="Grep"&&r.pattern)return`${e}(${r.pattern})`;if(r.url)return`${e}(${r.url})`;if(r.query)return`${e}(${r.query})`;if(e==="Task"){if(r.subagent_type)return`${e}(${r.subagent_type})`;if(r.description)return`${e}(${r.description})`}return e==="Skill"&&r.skill?`${e}(${r.skill})`:e==="LSP"&&r.operation?`${e}(${r.operation})`:e}formatTimestamp(e){let t=e.getFullYear(),r=String(e.getMonth()+1).padStart(2,"0"),n=String(e.getDate()).padStart(2,"0"),o=String(e.getHours()).padStart(2,"0"),i=String(e.getMinutes()).padStart(2,"0"),a=String(e.getSeconds()).padStart(2,"0"),m=String(e.getMilliseconds()).padStart(3,"0");return`${t}-${r}-${n} ${o}:${i}:${a}.${m}`}log(e,t,r,n,o){if(e<this.getLevel())return;this.ensureLogFileInitialized();let i=this.formatTimestamp(new Date),a=V[e].padEnd(5),m=t.padEnd(6),p="";n?.correlationId?p=`[${n.correlationId}] `:n?.sessionId&&(p=`[session-${n.sessionId}] `);let c="";o!=null&&(o instanceof Error?c=this.getLevel()===0?`
${o.message}
${o.stack}`:` ${o.message}`:this.getLevel()===0&&typeof o=="object"?c=`
`+JSON.stringify(o,null,2):c=" "+this.formatData(o));let _="";if(n){let{sessionId:g,memorySessionId:S,correlationId:h,...l}=n;Object.keys(l).length>0&&(_=` {${Object.entries(l).map(([f,R])=>`${f}=${R}`).join(", ")}}`)}let E=`[${i}] [${a}] [${m}] ${p}${r}${_}${c}`;if(this.logFilePath)try{(0,N.appendFileSync)(this.logFilePath,E+`
`,"utf8")}catch(g){process.stderr.write(`[LOGGER] Failed to write to log file: ${g}
`)}else process.stderr.write(E+`
`)}debug(e,t,r,n){this.log(0,e,t,r,n)}info(e,t,r,n){this.log(1,e,t,r,n)}warn(e,t,r,n){this.log(2,e,t,r,n)}error(e,t,r,n){this.log(3,e,t,r,n)}dataIn(e,t,r,n){this.info(e,`\u2192 ${t}`,r,n)}dataOut(e,t,r,n){this.info(e,`\u2190 ${t}`,r,n)}success(e,t,r,n){this.info(e,`\u2713 ${t}`,r,n)}failure(e,t,r,n){this.error(e,`\u2717 ${t}`,r,n)}timing(e,t,r,n){this.info(e,`\u23F1 ${t}`,n,{duration:`${r}ms`})}happyPathError(e,t,r,n,o=""){let p=((new Error().stack||"").split(`
`)[2]||"").match(/at\s+(?:.*\s+)?\(?([^:]+):(\d+):(\d+)\)?/),c=p?`${p[1].split("/").pop()}:${p[2]}`:"unknown",_={...r,location:c};return this.warn(e,`[HAPPY-PATH] ${t}`,_,n),o}},u=new K;var cs={};function ds(){return typeof __dirname<"u"?__dirname:(0,T.dirname)((0,_e.fileURLToPath)(cs.url))}var ps=ds();function us(){if(process.env.CLAUDE_MEM_DATA_DIR)return process.env.CLAUDE_MEM_DATA_DIR;let s=(0,T.join)((0,J.homedir)(),".claude-mem"),e=(0,T.join)(s,"settings.json");try{if((0,k.existsSync)(e)){let{readFileSync:t}=require("fs"),r=JSON.parse(t(e,"utf-8")),n=r.env??r;if(n.CLAUDE_MEM_DATA_DIR)return n.CLAUDE_MEM_DATA_DIR}}catch{}return s}var I=us(),A=process.env.CLAUDE_CONFIG_DIR||(0,T.join)((0,J.homedir)(),".claude"),Ds=(0,T.join)(A,"plugins","marketplaces","thedotmack"),Ms=(0,T.join)(I,"archives"),Ls=(0,T.join)(I,"logs"),xs=(0,T.join)(I,"trash"),Us=(0,T.join)(I,"backups"),ks=(0,T.join)(I,"modes"),ws=(0,T.join)(I,"settings.json"),Ee=(0,T.join)(I,"claude-mem.db"),Ps=(0,T.join)(I,"vector-db"),$s=(0,T.join)(I,"observer-sessions"),Fs=(0,T.join)(A,"settings.json"),js=(0,T.join)(A,"commands"),Xs=(0,T.join)(A,"CLAUDE.md");function ge(s){(0,k.mkdirSync)(s,{recursive:!0})}function Te(){try{let s=(0,le.execSync)("git rev-parse --show-toplevel",{cwd:process.cwd(),encoding:"utf8",stdio:["pipe","pipe","ignore"],windowsHide:!0}).trim();return(0,T.basename)((0,T.dirname)(s))+"/"+(0,T.basename)(s)}catch(s){u.debug("SYSTEM","Git root detection failed, using cwd basename",{cwd:process.cwd()},s);let e=process.cwd();return(0,T.basename)((0,T.dirname)(e))+"/"+(0,T.basename)(e)}}function Se(){return(0,T.join)(ps,"..")}var w=class{constructor(e){this.db=e}runAllMigrations(){this.initializeSchema(),this.ensureWorkerPortColumn(),this.ensurePromptTrackingColumns(),this.removeSessionSummariesUniqueConstraint(),this.addObservationHierarchicalFields(),this.makeObservationsTextNullable(),this.createUserPromptsTable(),this.ensureDiscoveryTokensColumn(),this.createPendingMessagesTable(),this.renameSessionIdColumns(),this.repairSessionIdColumnRename(),this.addFailedAtEpochColumn(),this.addOnUpdateCascadeToForeignKeys(),this.addObservationContentHashColumn(),this.addSessionCustomTitleColumn()}initializeSchema(){this.db.run(`
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
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(4,new Date().toISOString())}ensureWorkerPortColumn(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(r=>r.name==="worker_port")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN worker_port INTEGER"),u.debug("DB","Added worker_port column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(5,new Date().toISOString())}ensurePromptTrackingColumns(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(a=>a.name==="prompt_counter")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN prompt_counter INTEGER DEFAULT 0"),u.debug("DB","Added prompt_counter column to sdk_sessions table")),this.db.query("PRAGMA table_info(observations)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE observations ADD COLUMN prompt_number INTEGER"),u.debug("DB","Added prompt_number column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN prompt_number INTEGER"),u.debug("DB","Added prompt_number column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(6,new Date().toISOString())}removeSessionSummariesUniqueConstraint(){if(!this.db.query("PRAGMA index_list(session_summaries)").all().some(r=>r.unique===1)){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString());return}u.debug("DB","Removing UNIQUE constraint from session_summaries.memory_session_id"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS session_summaries_new"),this.db.run(`
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
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString()),u.debug("DB","Successfully removed UNIQUE constraint from session_summaries.memory_session_id")}addObservationHierarchicalFields(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(8))return;if(this.db.query("PRAGMA table_info(observations)").all().some(n=>n.name==="title")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString());return}u.debug("DB","Adding hierarchical fields to observations table"),this.db.run(`
      ALTER TABLE observations ADD COLUMN title TEXT;
      ALTER TABLE observations ADD COLUMN subtitle TEXT;
      ALTER TABLE observations ADD COLUMN facts TEXT;
      ALTER TABLE observations ADD COLUMN narrative TEXT;
      ALTER TABLE observations ADD COLUMN concepts TEXT;
      ALTER TABLE observations ADD COLUMN files_read TEXT;
      ALTER TABLE observations ADD COLUMN files_modified TEXT;
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString()),u.debug("DB","Successfully added hierarchical fields to observations table")}makeObservationsTextNullable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(9))return;let r=this.db.query("PRAGMA table_info(observations)").all().find(n=>n.name==="text");if(!r||r.notnull===0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString());return}u.debug("DB","Making observations.text nullable"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
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
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString()),u.debug("DB","Successfully made observations.text nullable")}createUserPromptsTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(10))return;if(this.db.query("PRAGMA table_info(user_prompts)").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString());return}u.debug("DB","Creating user_prompts table with FTS5 support"),this.db.run("BEGIN TRANSACTION"),this.db.run(`
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
      `)}catch(r){u.warn("DB","FTS5 not available \u2014 user_prompts_fts skipped (search uses ChromaDB)",{},r)}this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString()),u.debug("DB","Successfully created user_prompts table")}ensureDiscoveryTokensColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(11))return;this.db.query("PRAGMA table_info(observations)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE observations ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),u.debug("DB","Added discovery_tokens column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),u.debug("DB","Added discovery_tokens column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(11,new Date().toISOString())}createPendingMessagesTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(16))return;if(this.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_messages'").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString());return}u.debug("DB","Creating pending_messages table"),this.db.run(`
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
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_session ON pending_messages(session_db_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_claude_session ON pending_messages(content_session_id)"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString()),u.debug("DB","pending_messages table created successfully")}renameSessionIdColumns(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(17))return;u.debug("DB","Checking session ID columns for semantic clarity rename");let t=0,r=(n,o,i)=>{let a=this.db.query(`PRAGMA table_info(${n})`).all(),m=a.some(c=>c.name===o);return a.some(c=>c.name===i)?!1:m?(this.db.run(`ALTER TABLE ${n} RENAME COLUMN ${o} TO ${i}`),u.debug("DB",`Renamed ${n}.${o} to ${i}`),!0):(u.warn("DB",`Column ${o} not found in ${n}, skipping rename`),!1)};r("sdk_sessions","claude_session_id","content_session_id")&&t++,r("sdk_sessions","sdk_session_id","memory_session_id")&&t++,r("pending_messages","claude_session_id","content_session_id")&&t++,r("observations","sdk_session_id","memory_session_id")&&t++,r("session_summaries","sdk_session_id","memory_session_id")&&t++,r("user_prompts","claude_session_id","content_session_id")&&t++,this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(17,new Date().toISOString()),t>0?u.debug("DB",`Successfully renamed ${t} session ID columns`):u.debug("DB","No session ID column renames needed (already up to date)")}repairSessionIdColumnRename(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(19)||this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(19,new Date().toISOString())}addFailedAtEpochColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(20))return;this.db.query("PRAGMA table_info(pending_messages)").all().some(n=>n.name==="failed_at_epoch")||(this.db.run("ALTER TABLE pending_messages ADD COLUMN failed_at_epoch INTEGER"),u.debug("DB","Added failed_at_epoch column to pending_messages table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(20,new Date().toISOString())}addOnUpdateCascadeToForeignKeys(){if(!this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(21)){u.debug("DB","Adding ON UPDATE CASCADE to FK constraints on observations and session_summaries"),this.db.run("PRAGMA foreign_keys = OFF"),this.db.run("BEGIN TRANSACTION");try{this.db.run("DROP TRIGGER IF EXISTS observations_ai"),this.db.run("DROP TRIGGER IF EXISTS observations_ad"),this.db.run("DROP TRIGGER IF EXISTS observations_au"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
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
        `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(21,new Date().toISOString()),this.db.run("COMMIT"),this.db.run("PRAGMA foreign_keys = ON"),u.debug("DB","Successfully added ON UPDATE CASCADE to FK constraints")}catch(t){throw this.db.run("ROLLBACK"),this.db.run("PRAGMA foreign_keys = ON"),t}}}addObservationContentHashColumn(){if(this.db.query("PRAGMA table_info(observations)").all().some(r=>r.name==="content_hash")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(22,new Date().toISOString());return}this.db.run("ALTER TABLE observations ADD COLUMN content_hash TEXT"),this.db.run("UPDATE observations SET content_hash = substr(hex(randomblob(8)), 1, 16) WHERE content_hash IS NULL"),this.db.run("CREATE INDEX IF NOT EXISTS idx_observations_content_hash ON observations(content_hash, created_at_epoch)"),u.debug("DB","Added content_hash column to observations table with backfill and index"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(22,new Date().toISOString())}addSessionCustomTitleColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(23))return;this.db.query("PRAGMA table_info(sdk_sessions)").all().some(n=>n.name==="custom_title")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN custom_title TEXT"),u.debug("DB","Added custom_title column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(23,new Date().toISOString())}};var fe=require("crypto");var ls=3e4;function P(s,e,t){return(0,fe.createHash)("sha256").update((s||"")+(e||"")+(t||"")).digest("hex").slice(0,16)}function $(s,e,t){let r=t-ls;return s.prepare("SELECT id, created_at_epoch FROM observations WHERE content_hash = ? AND created_at_epoch > ?").get(e,r)}function be(s,e,t,r,n,o=0,i){let a=i??Date.now(),m=new Date(a).toISOString(),p=t||Te(),c=P(e,r.title,r.narrative),_=$(s,c,a);if(_)return u.debug("DEDUP",`Skipped duplicate observation | contentHash=${c} | existingId=${_.id}`),{id:_.id,createdAtEpoch:_.created_at_epoch};let g=s.prepare(`
    INSERT INTO observations
    (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
     files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e,p,r.type,r.title,r.subtitle,JSON.stringify(r.facts),r.narrative,JSON.stringify(r.concepts),JSON.stringify(r.files_read),JSON.stringify(r.files_modified),n||null,o,c,m,a);return{id:Number(g.lastInsertRowid),createdAtEpoch:a}}function Oe(s,e,t,r,n,o,i,a=0,m){let p=m??Date.now(),c=new Date(p).toISOString();return s.transaction(()=>{let E=[],g=s.prepare(`
      INSERT INTO observations
      (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
       files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);for(let l of r){let b=P(e,l.title,l.narrative),f=$(s,b,p);if(f){E.push(f.id);continue}let R=g.run(e,t,l.type,l.title,l.subtitle,JSON.stringify(l.facts),l.narrative,JSON.stringify(l.concepts),JSON.stringify(l.files_read),JSON.stringify(l.files_modified),i||null,a,b,c,p);E.push(Number(R.lastInsertRowid))}let S=null;if(n){let b=s.prepare(`
        INSERT INTO session_summaries
        (memory_session_id, project, request, investigated, learned, completed,
         next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(e,t,n.request,n.investigated,n.learned,n.completed,n.next_steps,n.notes,i||null,a,c,p);S=Number(b.lastInsertRowid)}return s.prepare(`
      UPDATE pending_messages
      SET
        status = 'processed',
        completed_at_epoch = ?,
        tool_input = NULL,
        tool_response = NULL
      WHERE id = ? AND status = 'processing'
    `).run(p,o),{observationIds:E,summaryId:S,createdAtEpoch:p}})()}function Re(s,e,t,r,n,o,i=0,a){let m=a??Date.now(),p=new Date(m).toISOString();return s.transaction(()=>{let _=[],E=s.prepare(`
      INSERT INTO observations
      (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
       files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);for(let S of r){let h=P(e,S.title,S.narrative),l=$(s,h,m);if(l){_.push(l.id);continue}let b=E.run(e,t,S.type,S.title,S.subtitle,JSON.stringify(S.facts),S.narrative,JSON.stringify(S.concepts),JSON.stringify(S.files_read),JSON.stringify(S.files_modified),o||null,i,h,p,m);_.push(Number(b.lastInsertRowid))}let g=null;if(n){let h=s.prepare(`
        INSERT INTO session_summaries
        (memory_session_id, project, request, investigated, learned, completed,
         next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(e,t,n.request,n.investigated,n.learned,n.completed,n.next_steps,n.notes,o||null,i,p,m);g=Number(h.lastInsertRowid)}return{observationIds:_,summaryId:g,createdAtEpoch:m}})()}function he(s,e){return s.prepare(`
    SELECT *
    FROM observations
    WHERE id = ?
  `).get(e)||null}function Ie(s,e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o,type:i,concepts:a,files:m}=t,p=r==="date_asc"?"ASC":"DESC",c=n?`LIMIT ${n}`:"",_=e.map(()=>"?").join(","),E=[...e],g=[];if(o&&(g.push("project = ?"),E.push(o)),i)if(Array.isArray(i)){let l=i.map(()=>"?").join(",");g.push(`type IN (${l})`),E.push(...i)}else g.push("type = ?"),E.push(i);if(a){let l=Array.isArray(a)?a:[a],b=l.map(()=>"EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?)");E.push(...l),g.push(`(${b.join(" OR ")})`)}if(m){let l=Array.isArray(m)?m:[m],b=l.map(()=>"(EXISTS (SELECT 1 FROM json_each(files_read) WHERE value LIKE ?) OR EXISTS (SELECT 1 FROM json_each(files_modified) WHERE value LIKE ?))");l.forEach(f=>{E.push(`%${f}%`,`%${f}%`)}),g.push(`(${b.join(" OR ")})`)}let S=g.length>0?`WHERE id IN (${_}) AND ${g.join(" AND ")}`:`WHERE id IN (${_})`;return s.prepare(`
    SELECT *
    FROM observations
    ${S}
    ORDER BY created_at_epoch ${p}
    ${c}
  `).all(...E)}function Ce(s,e){return s.prepare(`
    SELECT title, subtitle, type, prompt_number
    FROM observations
    WHERE memory_session_id = ?
    ORDER BY created_at_epoch ASC
  `).all(e)}function Ne(s,e,t=20){return s.prepare(`
    SELECT type, text, prompt_number, created_at
    FROM observations
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,t)}function Ae(s,e=100){return s.prepare(`
    SELECT id, type, title, subtitle, text, project, prompt_number, created_at, created_at_epoch
    FROM observations
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e)}function ye(s,e){let r=s.prepare(`
    SELECT files_read, files_modified
    FROM observations
    WHERE memory_session_id = ?
  `).all(e),n=new Set,o=new Set;for(let i of r){if(i.files_read){let a=JSON.parse(i.files_read);Array.isArray(a)&&a.forEach(m=>n.add(m))}if(i.files_modified){let a=JSON.parse(i.files_modified);Array.isArray(a)&&a.forEach(m=>o.add(m))}}return{filesRead:Array.from(n),filesModified:Array.from(o)}}function ve(s,e,t,r,n){let o=new Date,i=o.getTime(),a=s.prepare(`
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
  `).run(e,t,r,n||null,o.toISOString(),i),s.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(e).id)}function De(s,e,t){s.prepare(`
    UPDATE sdk_sessions
    SET memory_session_id = ?
    WHERE id = ?
  `).run(t,e)}function Me(s,e,t){let r=s.prepare(`
    SELECT id, memory_session_id FROM sdk_sessions WHERE id = ?
  `).get(e);if(!r)throw new Error(`Session ${e} not found in sdk_sessions`);r.memory_session_id!==t&&(s.prepare(`
      UPDATE sdk_sessions SET memory_session_id = ? WHERE id = ?
    `).run(t,e),u.info("DB","Registered memory_session_id before storage (FK fix)",{sessionDbId:e,oldId:r.memory_session_id,newId:t}))}function Le(s,e){let t=`manual-${e}`,r=`manual-content-${e}`;if(s.prepare("SELECT memory_session_id FROM sdk_sessions WHERE memory_session_id = ?").get(t))return t;let o=new Date;return s.prepare(`
    INSERT INTO sdk_sessions (memory_session_id, content_session_id, project, started_at, started_at_epoch, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(t,r,e,o.toISOString(),o.getTime()),u.info("SESSION","Created manual session",{memorySessionId:t,project:e}),t}function xe(s,e){return s.prepare(`
    SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title
    FROM sdk_sessions
    WHERE id = ?
    LIMIT 1
  `).get(e)||null}function Ue(s,e){if(e.length===0)return[];let t=e.map(()=>"?").join(",");return s.prepare(`
    SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title,
           started_at, started_at_epoch, completed_at, completed_at_epoch, status
    FROM sdk_sessions
    WHERE memory_session_id IN (${t})
    ORDER BY started_at_epoch DESC
  `).all(...e)}function ke(s,e,t=3){return s.prepare(`
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
  `).all(e,t)}function we(s,e){return s.prepare(`
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
  `).get(e)||null}function Pe(s,e,t,r,n,o=0,i){let a=i??Date.now(),m=new Date(a).toISOString(),c=s.prepare(`
    INSERT INTO session_summaries
    (memory_session_id, project, request, investigated, learned, completed,
     next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e,t,r.request,r.investigated,r.learned,r.completed,r.next_steps,r.notes,n||null,o,m,a);return{id:Number(c.lastInsertRowid),createdAtEpoch:a}}function $e(s,e){return s.prepare(`
    SELECT
      request, investigated, learned, completed, next_steps,
      files_read, files_edited, notes, prompt_number, created_at,
      created_at_epoch
    FROM session_summaries
    WHERE memory_session_id = ?
    ORDER BY created_at_epoch DESC
    LIMIT 1
  `).get(e)||null}function Fe(s,e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o}=t,i=r==="date_asc"?"ASC":"DESC",a=n?`LIMIT ${n}`:"",m=e.map(()=>"?").join(","),p=[...e],c=o?`WHERE id IN (${m}) AND project = ?`:`WHERE id IN (${m})`;return o&&p.push(o),s.prepare(`
    SELECT * FROM session_summaries
    ${c}
    ORDER BY created_at_epoch ${i}
    ${a}
  `).all(...p)}function je(s,e,t=10){return s.prepare(`
    SELECT
      request, investigated, learned, completed, next_steps,
      files_read, files_edited, notes, prompt_number, created_at
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,t)}function Xe(s,e,t=3){return s.prepare(`
    SELECT
      memory_session_id, request, learned, completed, next_steps,
      prompt_number, created_at
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,t)}function Be(s,e=50){return s.prepare(`
    SELECT id, request, investigated, learned, completed, next_steps,
           files_read, files_edited, notes, project, prompt_number,
           created_at, created_at_epoch
    FROM session_summaries
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e)}function Ge(s,e,t=10,r=10,n){return Q(s,null,e,t,r,n)}function Q(s,e,t,r=10,n=10,o){let i=o?"AND project = ?":"",a=o?[o]:[],m,p;if(e!==null){let l=`
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
    `;try{let f=s.prepare(l).all(e,...a,r+1),R=s.prepare(b).all(e,...a,n+1);if(f.length===0&&R.length===0)return{observations:[],sessions:[],prompts:[]};m=f.length>0?f[f.length-1].created_at_epoch:t,p=R.length>0?R[R.length-1].created_at_epoch:t}catch(f){return u.error("DB","Error getting boundary observations",void 0,{error:f,project:o}),{observations:[],sessions:[],prompts:[]}}}else{let l=`
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
    `;try{let f=s.prepare(l).all(t,...a,r),R=s.prepare(b).all(t,...a,n+1);if(f.length===0&&R.length===0)return{observations:[],sessions:[],prompts:[]};m=f.length>0?f[f.length-1].created_at_epoch:t,p=R.length>0?R[R.length-1].created_at_epoch:t}catch(f){return u.error("DB","Error getting boundary timestamps",void 0,{error:f,project:o}),{observations:[],sessions:[],prompts:[]}}}let c=`
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
  `,g=s.prepare(c).all(m,p,...a),S=s.prepare(_).all(m,p,...a),h=s.prepare(E).all(m,p,...a);return{observations:g,sessions:S.map(l=>({id:l.id,memory_session_id:l.memory_session_id,project:l.project,request:l.request,completed:l.completed,next_steps:l.next_steps,created_at:l.created_at,created_at_epoch:l.created_at_epoch})),prompts:h.map(l=>({id:l.id,content_session_id:l.content_session_id,prompt_number:l.prompt_number,prompt_text:l.prompt_text,project:l.project,created_at:l.created_at,created_at_epoch:l.created_at_epoch}))}}function He(s){return s.prepare(`
    SELECT DISTINCT project
    FROM sdk_sessions
    WHERE project IS NOT NULL AND project != ''
    ORDER BY project ASC
  `).all().map(r=>r.project)}function We(s,e,t){return s.prepare(`
    SELECT prompt_text
    FROM user_prompts
    WHERE content_session_id = ? AND prompt_number = ?
    LIMIT 1
  `).get(e,t)?.prompt_text??null}function Ye(s,e){return s.prepare(`
    SELECT COUNT(*) as count FROM user_prompts WHERE content_session_id = ?
  `).get(e).count}function qe(s,e){return s.prepare(`
    SELECT
      up.*,
      s.memory_session_id,
      s.project
    FROM user_prompts up
    JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    WHERE up.content_session_id = ?
    ORDER BY up.created_at_epoch DESC
    LIMIT 1
  `).get(e)}function Ve(s,e=100){return s.prepare(`
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
  `).all(e)}function Ke(s,e){return s.prepare(`
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
  `).get(e)||null}function Je(s,e){if(e.length===0)return[];let t=e.map(()=>"?").join(",");return s.prepare(`
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
  `).all(...e)}function Qe(s,e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o}=t,i=r==="date_asc"?"ASC":"DESC",a=n?`LIMIT ${n}`:"",m=e.map(()=>"?").join(","),p=[...e],c=o?"AND s.project = ?":"";return o&&p.push(o),s.prepare(`
    SELECT
      up.*,
      s.project,
      s.memory_session_id
    FROM user_prompts up
    JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    WHERE up.id IN (${m}) ${c}
    ORDER BY up.created_at_epoch ${i}
    ${a}
  `).all(...p)}function ze(s,e,t,r){let n=new Date,o=n.getTime();return s.prepare(`
    INSERT INTO user_prompts
    (content_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?)
  `).run(e,t,r,n.toISOString(),o).lastInsertRowid}function Ze(s,e){let t=s.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(e.content_session_id);return t?{imported:!1,id:t.id}:{imported:!0,id:s.prepare(`
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
  `).run(e.content_session_id,e.prompt_number,e.prompt_text,e.created_at,e.created_at_epoch).lastInsertRowid}}var F=class{db;constructor(e=Ee){e!==":memory:"&&ge(I),this.db=new rt.Database(e),this.db.run("PRAGMA journal_mode = WAL"),this.db.run("PRAGMA synchronous = NORMAL"),this.db.run("PRAGMA foreign_keys = ON"),new w(this.db).runAllMigrations()}updateMemorySessionId(e,t){return De(this.db,e,t)}ensureMemorySessionIdRegistered(e,t){return Me(this.db,e,t)}getRecentSummaries(e,t=10){return je(this.db,e,t)}getRecentSummariesWithSessionInfo(e,t=3){return Xe(this.db,e,t)}getRecentObservations(e,t=20){return Ne(this.db,e,t)}getAllRecentObservations(e=100){return Ae(this.db,e)}getAllRecentSummaries(e=50){return Be(this.db,e)}getAllRecentUserPrompts(e=100){return Ve(this.db,e)}getAllProjects(){return He(this.db)}getLatestUserPrompt(e){return qe(this.db,e)}getRecentSessionsWithStatus(e,t=3){return ke(this.db,e,t)}getObservationsForSession(e){return Ce(this.db,e)}getObservationById(e){return he(this.db,e)}getObservationsByIds(e,t={}){return Ie(this.db,e,t)}getSummaryForSession(e){return $e(this.db,e)}getFilesForSession(e){return ye(this.db,e)}getSessionById(e){return xe(this.db,e)}getSdkSessionsBySessionIds(e){return Ue(this.db,e)}getPromptNumberFromUserPrompts(e){return Ye(this.db,e)}createSDKSession(e,t,r,n){return ve(this.db,e,t,r,n)}saveUserPrompt(e,t,r){return ze(this.db,e,t,r)}getUserPrompt(e,t){return We(this.db,e,t)}storeObservation(e,t,r,n,o=0,i){return be(this.db,e,t,r,n,o,i)}storeSummary(e,t,r,n,o=0,i){return Pe(this.db,e,t,r,n,o,i)}storeObservations(e,t,r,n,o,i=0,a){return Re(this.db,e,t,r,n,o,i,a)}storeObservationsAndMarkComplete(e,t,r,n,o,i,a,m=0,p){return Oe(this.db,e,t,r,n,o,a,m,p)}getSessionSummariesByIds(e,t={}){return Fe(this.db,e,t)}getUserPromptsByIds(e,t={}){return Qe(this.db,e,t)}getTimelineAroundTimestamp(e,t=10,r=10,n){return Ge(this.db,e,t,r,n)}getTimelineAroundObservation(e,t,r=10,n=10,o){return Q(this.db,e,t,r,n,o)}getPromptById(e){return Ke(this.db,e)}getPromptsByIds(e){return Je(this.db,e)}getSessionSummaryById(e){return we(this.db,e)}getOrCreateManualSession(e){return Le(this.db,e)}close(){this.db.close()}importSdkSession(e){return Ze(this.db,e)}importSessionSummary(e){return et(this.db,e)}importObservation(e){return tt(this.db,e)}importUserPrompt(e){return st(this.db,e)}};var nt=y(require("path"),1);function ot(s){if(!s||s.trim()==="")return u.warn("PROJECT_NAME","Empty cwd provided, using fallback",{cwd:s}),"unknown-project";let e=nt.default.basename(s);if(e===""){if(process.platform==="win32"){let r=s.match(/^([A-Z]):\\/i);if(r){let o=`drive-${r[1].toUpperCase()}`;return u.info("PROJECT_NAME","Drive root detected",{cwd:s,projectName:o}),o}}return u.warn("PROJECT_NAME","Root directory detected, using fallback",{cwd:s}),"unknown-project"}return e}var at=y(require("path"),1),mt=require("os");var C=require("fs"),X=require("path"),it=require("os"),j=class{static DEFAULTS={CLAUDE_MEM_MODEL:"claude-sonnet-4-5",CLAUDE_MEM_CONTEXT_OBSERVATIONS:"50",CLAUDE_MEM_WORKER_PORT:"37777",CLAUDE_MEM_WORKER_HOST:"127.0.0.1",CLAUDE_MEM_SKIP_TOOLS:"ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion",CLAUDE_MEM_PROVIDER:"claude",CLAUDE_MEM_CLAUDE_AUTH_METHOD:"cli",CLAUDE_MEM_GEMINI_API_KEY:"",CLAUDE_MEM_GEMINI_MODEL:"gemini-2.5-flash-lite",CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED:"true",CLAUDE_MEM_OPENROUTER_API_KEY:"",CLAUDE_MEM_OPENROUTER_MODEL:"xiaomi/mimo-v2-flash:free",CLAUDE_MEM_OPENROUTER_SITE_URL:"",CLAUDE_MEM_OPENROUTER_APP_NAME:"claude-mem",CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES:"20",CLAUDE_MEM_OPENROUTER_MAX_TOKENS:"100000",CLAUDE_MEM_DATA_DIR:(0,X.join)((0,it.homedir)(),".claude-mem"),CLAUDE_MEM_LOG_LEVEL:"INFO",CLAUDE_MEM_PYTHON_VERSION:"3.13",CLAUDE_CODE_PATH:"",CLAUDE_MEM_MODE:"code",CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS:"false",CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS:"false",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT:"false",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT:"true",CLAUDE_MEM_CONTEXT_FULL_COUNT:"0",CLAUDE_MEM_CONTEXT_FULL_FIELD:"narrative",CLAUDE_MEM_CONTEXT_SESSION_COUNT:"10",CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY:"true",CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE:"false",CLAUDE_MEM_CONTEXT_SHOW_TERMINAL_OUTPUT:"true",CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED:"false",CLAUDE_MEM_MAX_CONCURRENT_AGENTS:"2",CLAUDE_MEM_EXCLUDED_PROJECTS:"",CLAUDE_MEM_FOLDER_MD_EXCLUDE:"[]",CLAUDE_MEM_CHROMA_ENABLED:"true",CLAUDE_MEM_CHROMA_MODE:"local",CLAUDE_MEM_CHROMA_HOST:"127.0.0.1",CLAUDE_MEM_CHROMA_PORT:"8000",CLAUDE_MEM_CHROMA_SSL:"false",CLAUDE_MEM_CHROMA_API_KEY:"",CLAUDE_MEM_CHROMA_TENANT:"default_tenant",CLAUDE_MEM_CHROMA_DATABASE:"default_database"};static getAllDefaults(){return{...this.DEFAULTS}}static get(e){return process.env[e]??this.DEFAULTS[e]}static getInt(e){let t=this.get(e);return parseInt(t,10)}static getBool(e){return this.get(e)==="true"}static applyEnvOverrides(e){let t={...e};for(let r of Object.keys(this.DEFAULTS))process.env[r]!==void 0&&(t[r]=process.env[r]);return t}static loadFromFile(e){try{if(!(0,C.existsSync)(e)){let i=this.getAllDefaults();try{let a=(0,X.dirname)(e);(0,C.existsSync)(a)||(0,C.mkdirSync)(a,{recursive:!0}),(0,C.writeFileSync)(e,JSON.stringify(i,null,2),"utf-8"),console.log("[SETTINGS] Created settings file with defaults:",e)}catch(a){console.warn("[SETTINGS] Failed to create settings file, using in-memory defaults:",e,a)}return this.applyEnvOverrides(i)}let t=(0,C.readFileSync)(e,"utf-8"),r=JSON.parse(t),n=r;if(r.env&&typeof r.env=="object"){n=r.env;try{(0,C.writeFileSync)(e,JSON.stringify(n,null,2),"utf-8"),console.log("[SETTINGS] Migrated settings file from nested to flat schema:",e)}catch(i){console.warn("[SETTINGS] Failed to auto-migrate settings file:",e,i)}}let o={...this.DEFAULTS};for(let i of Object.keys(this.DEFAULTS))n[i]!==void 0&&(o[i]=n[i]);return this.applyEnvOverrides(o)}catch(t){return console.warn("[SETTINGS] Failed to load settings, using defaults:",e,t),this.applyEnvOverrides(this.getAllDefaults())}}};var D=require("fs"),B=require("path");var O=class s{static instance=null;activeMode=null;modesDir;constructor(){let e=Se(),t=[(0,B.join)(e,"modes"),(0,B.join)(e,"..","plugin","modes")],r=t.find(n=>(0,D.existsSync)(n));this.modesDir=r||t[0]}static getInstance(){return s.instance||(s.instance=new s),s.instance}parseInheritance(e){let t=e.split("--");if(t.length===1)return{hasParent:!1,parentId:"",overrideId:""};if(t.length>2)throw new Error(`Invalid mode inheritance: ${e}. Only one level of inheritance supported (parent--override)`);return{hasParent:!0,parentId:t[0],overrideId:e}}isPlainObject(e){return e!==null&&typeof e=="object"&&!Array.isArray(e)}deepMerge(e,t){let r={...e};for(let n in t){let o=t[n],i=e[n];this.isPlainObject(o)&&this.isPlainObject(i)?r[n]=this.deepMerge(i,o):r[n]=o}return r}loadModeFile(e){let t=(0,B.join)(this.modesDir,`${e}.json`);if(!(0,D.existsSync)(t))throw new Error(`Mode file not found: ${t}`);let r=(0,D.readFileSync)(t,"utf-8");return JSON.parse(r)}loadMode(e){let t=this.parseInheritance(e);if(!t.hasParent)try{let m=this.loadModeFile(e);return this.activeMode=m,u.debug("SYSTEM",`Loaded mode: ${m.name} (${e})`,void 0,{types:m.observation_types.map(p=>p.id),concepts:m.observation_concepts.map(p=>p.id)}),m}catch{if(u.warn("SYSTEM",`Mode file not found: ${e}, falling back to 'code'`),e==="code")throw new Error("Critical: code.json mode file missing");return this.loadMode("code")}let{parentId:r,overrideId:n}=t,o;try{o=this.loadMode(r)}catch{u.warn("SYSTEM",`Parent mode '${r}' not found for ${e}, falling back to 'code'`),o=this.loadMode("code")}let i;try{i=this.loadModeFile(n),u.debug("SYSTEM",`Loaded override file: ${n} for parent ${r}`)}catch{return u.warn("SYSTEM",`Override file '${n}' not found, using parent mode '${r}' only`),this.activeMode=o,o}if(!i)return u.warn("SYSTEM",`Invalid override file: ${n}, using parent mode '${r}' only`),this.activeMode=o,o;let a=this.deepMerge(o,i);return this.activeMode=a,u.debug("SYSTEM",`Loaded mode with inheritance: ${a.name} (${e} = ${r} + ${n})`,void 0,{parent:r,override:n,types:a.observation_types.map(m=>m.id),concepts:a.observation_concepts.map(m=>m.id)}),a}getActiveMode(){if(!this.activeMode)throw new Error("No mode loaded. Call loadMode() first.");return this.activeMode}getObservationTypes(){return this.getActiveMode().observation_types}getObservationConcepts(){return this.getActiveMode().observation_concepts}getTypeIcon(e){return this.getObservationTypes().find(r=>r.id===e)?.emoji||"\u{1F4DD}"}getWorkEmoji(e){return this.getObservationTypes().find(r=>r.id===e)?.work_emoji||"\u{1F4DD}"}validateType(e){return this.getObservationTypes().some(t=>t.id===e)}getTypeLabel(e){return this.getObservationTypes().find(r=>r.id===e)?.label||e}};function z(){let s=at.default.join((0,mt.homedir)(),".claude-mem","settings.json"),e=j.loadFromFile(s),t=O.getInstance().getActiveMode(),r=new Set(t.observation_types.map(o=>o.id)),n=new Set(t.observation_concepts.map(o=>o.id));return{totalObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_OBSERVATIONS,10),fullObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_FULL_COUNT,10),sessionCount:parseInt(e.CLAUDE_MEM_CONTEXT_SESSION_COUNT,10),showReadTokens:e.CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS==="true",showWorkTokens:e.CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS==="true",showSavingsAmount:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT==="true",showSavingsPercent:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT==="true",observationTypes:r,observationConcepts:n,fullObservationField:e.CLAUDE_MEM_CONTEXT_FULL_FIELD,showLastSummary:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY==="true",showLastMessage:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE==="true"}}var d={reset:"\x1B[0m",bright:"\x1B[1m",dim:"\x1B[2m",cyan:"\x1B[36m",green:"\x1B[32m",yellow:"\x1B[33m",blue:"\x1B[34m",magenta:"\x1B[35m",gray:"\x1B[90m",red:"\x1B[31m"},dt=4,Z=1;function ee(s){let e=(s.title?.length||0)+(s.subtitle?.length||0)+(s.narrative?.length||0)+JSON.stringify(s.facts||[]).length;return Math.ceil(e/dt)}function te(s){let e=s.length,t=s.reduce((i,a)=>i+ee(a),0),r=s.reduce((i,a)=>i+(a.discovery_tokens||0),0),n=r-t,o=r>0?Math.round(n/r*100):0;return{totalObservations:e,totalReadTokens:t,totalDiscoveryTokens:r,savings:n,savingsPercent:o}}function _s(s){return O.getInstance().getWorkEmoji(s)}function M(s,e){let t=ee(s),r=s.discovery_tokens||0,n=_s(s.type),o=r>0?`${n} ${r.toLocaleString()}`:"-";return{readTokens:t,discoveryTokens:r,discoveryDisplay:o,workEmoji:n}}function G(s){return s.showReadTokens||s.showWorkTokens||s.showSavingsAmount||s.showSavingsPercent}var pt=y(require("path"),1),H=require("fs");function se(s,e,t){let r=Array.from(t.observationTypes),n=r.map(()=>"?").join(","),o=Array.from(t.observationConcepts),i=o.map(()=>"?").join(",");return s.db.prepare(`
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
  `).all(e,t.sessionCount+Z)}function ut(s,e,t){let r=Array.from(t.observationTypes),n=r.map(()=>"?").join(","),o=Array.from(t.observationConcepts),i=o.map(()=>"?").join(","),a=e.map(()=>"?").join(",");return s.db.prepare(`
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
  `).all(...e,...r,...o,t.totalObservationCount)}function ct(s,e,t){let r=e.map(()=>"?").join(",");return s.db.prepare(`
    SELECT id, memory_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch, project
    FROM session_summaries
    WHERE project IN (${r})
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(...e,t.sessionCount+Z)}function Es(s){return s.replace(/\//g,"-")}function gs(s){try{if(!(0,H.existsSync)(s))return{userMessage:"",assistantMessage:""};let e=(0,H.readFileSync)(s,"utf-8").trim();if(!e)return{userMessage:"",assistantMessage:""};let t=e.split(`
`).filter(n=>n.trim()),r="";for(let n=t.length-1;n>=0;n--)try{let o=t[n];if(!o.includes('"type":"assistant"'))continue;let i=JSON.parse(o);if(i.type==="assistant"&&i.message?.content&&Array.isArray(i.message.content)){let a="";for(let m of i.message.content)m.type==="text"&&(a+=m.text);if(a=a.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").trim(),a){r=a;break}}}catch(o){u.debug("PARSER","Skipping malformed transcript line",{lineIndex:n},o);continue}return{userMessage:"",assistantMessage:r}}catch(e){return u.failure("WORKER","Failed to extract prior messages from transcript",{transcriptPath:s},e),{userMessage:"",assistantMessage:""}}}function ne(s,e,t,r){if(!e.showLastMessage||s.length===0)return{userMessage:"",assistantMessage:""};let n=s.find(m=>m.memory_session_id!==t);if(!n)return{userMessage:"",assistantMessage:""};let o=n.memory_session_id,i=Es(r),a=pt.default.join(A,"projects",i,`${o}.jsonl`);return gs(a)}function lt(s,e){let t=e[0]?.id;return s.map((r,n)=>{let o=n===0?null:e[n+1];return{...r,displayEpoch:o?o.created_at_epoch:r.created_at_epoch,displayTime:o?o.created_at:r.created_at,shouldShowLink:r.id!==t}})}function oe(s,e){let t=[...s.map(r=>({type:"observation",data:r})),...e.map(r=>({type:"summary",data:r}))];return t.sort((r,n)=>{let o=r.type==="observation"?r.data.created_at_epoch:r.data.displayEpoch,i=n.type==="observation"?n.data.created_at_epoch:n.data.displayEpoch;return o-i}),t}function _t(s,e){return new Set(s.slice(0,e).map(t=>t.id))}function Et(){let s=new Date,e=s.toLocaleDateString("en-CA"),t=s.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}).toLowerCase().replace(" ",""),r=s.toLocaleTimeString("en-US",{timeZoneName:"short"}).split(" ").pop();return`${e} ${t} ${r}`}function gt(s){return[`# $CMEM ${s} ${Et()}`,""]}function Tt(){return[`Legend: \u{1F3AF}session ${O.getInstance().getActiveMode().observation_types.map(t=>`${t.emoji}${t.id}`).join(" ")}`,"Format: ID TIME TYPE TITLE","Fetch details: get_observations([IDs]) | Search: mem-search skill",""]}function St(){return[]}function ft(){return[]}function bt(s,e){let t=[],r=[`${s.totalObservations} obs (${s.totalReadTokens.toLocaleString()}t read)`,`${s.totalDiscoveryTokens.toLocaleString()}t work`];return s.totalDiscoveryTokens>0&&(e.showSavingsAmount||e.showSavingsPercent)&&(e.showSavingsPercent?r.push(`${s.savingsPercent}% savings`):e.showSavingsAmount&&r.push(`${s.savings.toLocaleString()}t saved`)),t.push(`Stats: ${r.join(" | ")}`),t.push(""),t}function Ot(s){return[`### ${s}`]}function Rt(s){return s.toLowerCase().replace(" am","a").replace(" pm","p")}function ht(s,e,t){let r=s.title||"Untitled",n=O.getInstance().getTypeIcon(s.type),o=e?Rt(e):'"';return`${s.id} ${o} ${n} ${r}`}function It(s,e,t,r){let n=[],o=s.title||"Untitled",i=O.getInstance().getTypeIcon(s.type),a=e?Rt(e):'"',{readTokens:m,discoveryDisplay:p}=M(s,r);n.push(`**${s.id}** ${a} ${i} **${o}**`),t&&n.push(t);let c=[];return r.showReadTokens&&c.push(`~${m}t`),r.showWorkTokens&&c.push(p),c.length>0&&n.push(c.join(" ")),n.push(""),n}function Ct(s,e){return[`S${s.id} ${s.request||"Session started"} (${e})`]}function L(s,e){return e?[`**${s}**: ${e}`,""]:[]}function Nt(s){return s.assistantMessage?["","---","","**Previously**","",`A: ${s.assistantMessage}`,""]:[]}function At(s,e){return["",`Access ${Math.round(s/1e3)}k tokens of past work via get_observations([IDs]) or mem-search skill.`]}function yt(s){return`# $CMEM ${s} ${Et()}

No previous sessions found.`}function vt(){let s=new Date,e=s.toLocaleDateString("en-CA"),t=s.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}).toLowerCase().replace(" ",""),r=s.toLocaleTimeString("en-US",{timeZoneName:"short"}).split(" ").pop();return`${e} ${t} ${r}`}function Dt(s){return["",`${d.bright}${d.cyan}[${s}] recent context, ${vt()}${d.reset}`,`${d.gray}${"\u2500".repeat(60)}${d.reset}`,""]}function Mt(){let e=O.getInstance().getActiveMode().observation_types.map(t=>`${t.emoji} ${t.id}`).join(" | ");return[`${d.dim}Legend: session-request | ${e}${d.reset}`,""]}function Lt(){return[`${d.bright}Column Key${d.reset}`,`${d.dim}  Read: Tokens to read this observation (cost to learn it now)${d.reset}`,`${d.dim}  Work: Tokens spent on work that produced this record ( research, building, deciding)${d.reset}`,""]}function xt(){return[`${d.dim}Context Index: This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.${d.reset}`,"",`${d.dim}When you need implementation details, rationale, or debugging context:${d.reset}`,`${d.dim}  - Fetch by ID: get_observations([IDs]) for observations visible in this index${d.reset}`,`${d.dim}  - Search history: Use the mem-search skill for past decisions, bugs, and deeper research${d.reset}`,`${d.dim}  - Trust this index over re-reading code for past decisions and learnings${d.reset}`,""]}function Ut(s,e){let t=[];if(t.push(`${d.bright}${d.cyan}Context Economics${d.reset}`),t.push(`${d.dim}  Loading: ${s.totalObservations} observations (${s.totalReadTokens.toLocaleString()} tokens to read)${d.reset}`),t.push(`${d.dim}  Work investment: ${s.totalDiscoveryTokens.toLocaleString()} tokens spent on research, building, and decisions${d.reset}`),s.totalDiscoveryTokens>0&&(e.showSavingsAmount||e.showSavingsPercent)){let r="  Your savings: ";e.showSavingsAmount&&e.showSavingsPercent?r+=`${s.savings.toLocaleString()} tokens (${s.savingsPercent}% reduction from reuse)`:e.showSavingsAmount?r+=`${s.savings.toLocaleString()} tokens`:r+=`${s.savingsPercent}% reduction from reuse`,t.push(`${d.green}${r}${d.reset}`)}return t.push(""),t}function kt(s){return[`${d.bright}${d.cyan}${s}${d.reset}`,""]}function wt(s){return[`${d.dim}${s}${d.reset}`]}function Pt(s,e,t,r){let n=s.title||"Untitled",o=O.getInstance().getTypeIcon(s.type),{readTokens:i,discoveryTokens:a,workEmoji:m}=M(s,r),p=t?`${d.dim}${e}${d.reset}`:" ".repeat(e.length),c=r.showReadTokens&&i>0?`${d.dim}(~${i}t)${d.reset}`:"",_=r.showWorkTokens&&a>0?`${d.dim}(${m} ${a.toLocaleString()}t)${d.reset}`:"";return`  ${d.dim}#${s.id}${d.reset}  ${p}  ${o}  ${n} ${c} ${_}`}function $t(s,e,t,r,n){let o=[],i=s.title||"Untitled",a=O.getInstance().getTypeIcon(s.type),{readTokens:m,discoveryTokens:p,workEmoji:c}=M(s,n),_=t?`${d.dim}${e}${d.reset}`:" ".repeat(e.length),E=n.showReadTokens&&m>0?`${d.dim}(~${m}t)${d.reset}`:"",g=n.showWorkTokens&&p>0?`${d.dim}(${c} ${p.toLocaleString()}t)${d.reset}`:"";return o.push(`  ${d.dim}#${s.id}${d.reset}  ${_}  ${a}  ${d.bright}${i}${d.reset}`),r&&o.push(`    ${d.dim}${r}${d.reset}`),(E||g)&&o.push(`    ${E} ${g}`),o.push(""),o}function Ft(s,e){let t=`${s.request||"Session started"} (${e})`;return[`${d.yellow}#S${s.id}${d.reset} ${t}`,""]}function x(s,e,t){return e?[`${t}${s}:${d.reset} ${e}`,""]:[]}function jt(s){return s.assistantMessage?["","---","",`${d.bright}${d.magenta}Previously${d.reset}`,"",`${d.dim}A: ${s.assistantMessage}${d.reset}`,""]:[]}function Xt(s,e){let t=Math.round(s/1e3);return["",`${d.dim}Access ${t}k tokens of past research & decisions for just ${e.toLocaleString()}t. Use the claude-mem skill to access memories by ID.${d.reset}`]}function Bt(s){return`
${d.bright}${d.cyan}[${s}] recent context, ${vt()}${d.reset}
${d.gray}${"\u2500".repeat(60)}${d.reset}

${d.dim}No previous sessions found for this project yet.${d.reset}
`}function Gt(s,e,t,r){let n=[];return r?n.push(...Dt(s)):n.push(...gt(s)),r?n.push(...Mt()):n.push(...Tt()),r?n.push(...Lt()):n.push(...St()),r?n.push(...xt()):n.push(...ft()),G(t)&&(r?n.push(...Ut(e,t)):n.push(...bt(e,t))),n}var ie=y(require("path"),1);function q(s){if(!s)return[];try{let e=JSON.parse(s);return Array.isArray(e)?e:[]}catch(e){return u.debug("PARSER","Failed to parse JSON array, using empty fallback",{preview:s?.substring(0,50)},e),[]}}function ae(s){return new Date(s).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0})}function me(s){return new Date(s).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})}function Wt(s){return new Date(s).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}function Ht(s,e){return ie.default.isAbsolute(s)?ie.default.relative(e,s):s}function Yt(s,e,t){let r=q(s);if(r.length>0)return Ht(r[0],e);if(t){let n=q(t);if(n.length>0)return Ht(n[0],e)}return"General"}function Ts(s){let e=new Map;for(let r of s){let n=r.type==="observation"?r.data.created_at:r.data.displayTime,o=Wt(n);e.has(o)||e.set(o,[]),e.get(o).push(r)}let t=Array.from(e.entries()).sort((r,n)=>{let o=new Date(r[0]).getTime(),i=new Date(n[0]).getTime();return o-i});return new Map(t)}function qt(s,e){return e.fullObservationField==="narrative"?s.narrative:s.facts?q(s.facts).join(`
`):null}function Ss(s,e,t,r){let n=[];n.push(...Ot(s));let o="";for(let i of e)if(i.type==="summary"){o="";let a=i.data,m=ae(a.displayTime);n.push(...Ct(a,m))}else{let a=i.data,m=me(a.created_at),c=m!==o?m:"";if(o=m,t.has(a.id)){let E=qt(a,r);n.push(...It(a,c,E,r))}else n.push(ht(a,c,r))}return n}function fs(s,e,t,r,n){let o=[];o.push(...kt(s));let i=null,a="";for(let m of e)if(m.type==="summary"){i=null,a="";let p=m.data,c=ae(p.displayTime);o.push(...Ft(p,c))}else{let p=m.data,c=Yt(p.files_modified,n,p.files_read),_=me(p.created_at),E=_!==a;a=_;let g=t.has(p.id);if(c!==i&&(o.push(...wt(c)),i=c),g){let S=qt(p,r);o.push(...$t(p,_,E,S,r))}else o.push(Pt(p,_,E,r))}return o.push(""),o}function bs(s,e,t,r,n,o){return o?fs(s,e,t,r,n):Ss(s,e,t,r)}function Vt(s,e,t,r,n){let o=[],i=Ts(s);for(let[a,m]of i)o.push(...bs(a,m,e,t,r,n));return o}function Kt(s,e,t){return!(!s.showLastSummary||!e||!!!(e.investigated||e.learned||e.completed||e.next_steps)||t&&e.created_at_epoch<=t.created_at_epoch)}function Jt(s,e){let t=[];return e?(t.push(...x("Investigated",s.investigated,d.blue)),t.push(...x("Learned",s.learned,d.yellow)),t.push(...x("Completed",s.completed,d.green)),t.push(...x("Next Steps",s.next_steps,d.magenta))):(t.push(...L("Investigated",s.investigated)),t.push(...L("Learned",s.learned)),t.push(...L("Completed",s.completed)),t.push(...L("Next Steps",s.next_steps))),t}function Qt(s,e){return e?jt(s):Nt(s)}function zt(s,e,t){return!G(e)||s.totalDiscoveryTokens<=0||s.savings<=0?[]:t?Xt(s.totalDiscoveryTokens,s.totalReadTokens):At(s.totalDiscoveryTokens,s.totalReadTokens)}var Os=Zt.default.join((0,es.homedir)(),".claude","plugins","marketplaces","thedotmack","plugin",".install-version");function Rs(){try{return new F}catch(s){if(s.code==="ERR_DLOPEN_FAILED"){try{(0,ts.unlinkSync)(Os)}catch(e){u.debug("SYSTEM","Marker file cleanup failed (may not exist)",{},e)}return u.error("SYSTEM","Native module rebuild needed - restart Claude Code to auto-fix"),null}throw s}}function hs(s,e){return e?Bt(s):yt(s)}function Is(s,e,t,r,n,o,i){let a=[],m=te(e);a.push(...Gt(s,m,r,i));let p=t.slice(0,r.sessionCount),c=lt(p,t),_=oe(e,c),E=_t(e,r.fullObservationCount);a.push(...Vt(_,E,r,n,i));let g=t[0],S=e[0];Kt(r,g,S)&&a.push(...Jt(g,i));let h=ne(e,r,o,n);return a.push(...Qt(h,i)),a.push(...zt(m,r,i)),a.join(`
`).trimEnd()}async function de(s,e=!1){let t=z(),r=s?.cwd??process.cwd(),n=ot(r),o=s?.projects||[n];s?.full&&(t.totalObservationCount=999999,t.sessionCount=999999);let i=Rs();if(!i)return"";try{let a=o.length>1?ut(i,o,t):se(i,n,t),m=o.length>1?ct(i,o,t):re(i,n,t);return a.length===0&&m.length===0?hs(n,e):Is(n,a,m,t,r,s?.session_id,e)}finally{i.close()}}0&&(module.exports={generateContext});
