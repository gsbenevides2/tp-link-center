// Sistema de Logging e Exportação para CSV
class APILogger {
    constructor() {
        this.logs = [];
        this.pendingCalls = new Map(); // Rastreia chamadas em andamento
        this.startTime = Date.now();
        this.callCounter = 0;
    }

    // Função auxiliar para clonar objetos com segurança
    safeClone(obj) {
        const seen = new WeakSet();
        if(obj === undefined) return {}
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (typeof value === "function") {
                return "[Function]";
            }
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) {
                    return "[Circular]";
                }
                seen.add(value);
            }
            return value;
        }));
    }

    // Função para serializar valores complexos
    stringify(value) {
        if (value === null || value === undefined) return "";
        if (typeof value === "object") {
            return JSON.stringify(value);
        }
        return String(value);
    }

    // Registra o início de uma chamada
    logRequest(method, data) {
        const callId = `${method}_${++this.callCounter}_${Date.now()}`;
        const timestamp = new Date().toISOString();
        const startTime = Date.now();

        const logEntry = {
            id: callId,
            timestamp,
            method,
            requestData: this.safeClone(data),
            requestSize: JSON.stringify(data).length,
            responseData: null,
            responseSize: 0,
            status: "pending",
            error: null,
            duration: 0,
            elapsedMs: startTime - this.startTime,
        };

        this.pendingCalls.set(callId, logEntry);
        return callId;
    }

    // Completa a chamada com sucesso
    logSuccess(callId, data) {
        if (!this.pendingCalls.has(callId)) return;

        const logEntry = this.pendingCalls.get(callId);
        logEntry.responseData = this.safeClone(data);
        logEntry.responseSize = JSON.stringify(data).length;
        logEntry.status = "success";
        logEntry.duration = Date.now() - (this.startTime + logEntry.elapsedMs);

        this.pendingCalls.delete(callId);
        this.logs.push(logEntry);
    }

    // Completa a chamada com erro
    logError(callId, error) {
        if (!this.pendingCalls.has(callId)) return;

        const logEntry = this.pendingCalls.get(callId);
        logEntry.error = this.safeClone(error);
        logEntry.status = "error";
        logEntry.duration = Date.now() - (this.startTime + logEntry.elapsedMs);

        this.pendingCalls.delete(callId);
        this.logs.push(logEntry);
    }

    // Exporta para CSV
    exportCSV() {
        if (this.logs.length === 0) {
            console.warn("Nenhum log para exportar");
            return;
        }

        // Cabeçalhos CSV
        const headers = [
            "ID Chamada",
            "Timestamp",
            "Método",
            "Status",
            "Request (JSON)",
            "Tamanho Request (bytes)",
            "Response (JSON)",
            "Tamanho Response (bytes)",
            "Erro",
            "Duração (ms)"
        ];

        // Converte logs para linhas CSV - UMA LINHA POR CHAMADA
        const rows = this.logs.map(log => [
            log.id,
            log.timestamp,
            log.method,
            log.status.toUpperCase(),
            this.stringify(log.requestData),
            log.requestSize,
            this.stringify(log.responseData),
            log.responseSize,
            this.stringify(log.error),
            log.duration
        ]);

        // Cria CSV com escape de aspas
        const csv = [
            headers.map(h => this.escapeCSV(h)).join(","),
            ...rows.map(row => row.map(cell => this.escapeCSV(cell)).join(","))
        ].join("\n");

        return csv;
    }

    // Função auxiliar para escapar valores CSV
    escapeCSV(value) {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    // Faz download do CSV
    downloadCSV(filename = "api_logs.csv") {
        const csv = this.exportCSV();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log(`✅ CSV exportado: ${filename} (${this.logs.length} registros)`);
    }

    // Gera resumo das chamadas
    getSummary() {
        const summary = {
            totalCalls: this.logs.length,
            callsByMethod: {},
            callsByStatus: {},
            successRate: 0,
            averageDataSize: 0,
            averageDuration: 0,
            totalTimespan: `${Date.now() - this.startTime}ms`,
            pendingCalls: this.pendingCalls.size
        };

        if (this.logs.length === 0) return summary;

        let totalDuration = 0;
        let totalSize = 0;

        this.logs.forEach(log => {
            // Por método
            summary.callsByMethod[log.method] = (summary.callsByMethod[log.method] || 0) + 1;
            
            // Por status
            summary.callsByStatus[log.status] = (summary.callsByStatus[log.status] || 0) + 1;
            
            // Duração
            totalDuration += log.duration;
            
            // Tamanho total
            totalSize += log.requestSize + log.responseSize;
        });

        // Taxa de sucesso
        const successCount = summary.callsByStatus["success"] || 0;
        const errorCount = summary.callsByStatus["error"] || 0;
        summary.successRate = successCount + errorCount > 0 
            ? ((successCount / (successCount + errorCount)) * 100).toFixed(2) + "%" 
            : "N/A";

        // Tamanho médio dos dados
        summary.averageDataSize = (totalSize / this.logs.length).toFixed(2) + " bytes";

        // Duração média
        summary.averageDuration = (totalDuration / this.logs.length).toFixed(2) + " ms";

        return summary;
    }

    // Limpa os logs
    clear() {
        this.logs = [];
        this.startTime = Date.now();
        console.log("✅ Logs limpos");
    }

    // Exibe summary no console
    printSummary() {
        console.table(this.getSummary());
    }
}

// ============================================
// INICIALIZA O LOGGER E INTERCEPTA AS CHAMADAS
// ============================================

const apiLogger = new APILogger();

function safeClone(obj) {
    return apiLogger.safeClone(obj);
}

// Intercepta os métodos do $.dm
["add", "set", "del", "get", "getList"].forEach(method => {
    const original = $.dm[method];
    if (typeof original !== "function") {
        return;
    }

    $.dm[method] = function (obj = {}) {
        console.group(`$.dm.${method}`);
        console.log("Request:");
        const clonedRequest = safeClone(obj);
        console.dir(clonedRequest);

        // Registra o INÍCIO da chamada
        const callId = apiLogger.logRequest(method, clonedRequest);

        const callback = obj.callback ?? {};
        obj.callback = {
            ...callback,
            success(data, ...args) {
                console.log("Success:");
                const clonedData = safeClone(data);
                console.dir(clonedData);
                
                // Registra o SUCESSO (completa a chamada)
                apiLogger.logSuccess(callId, clonedData);
                
                console.groupEnd();
                return callback.success?.call(this, data, ...args);
            },
            error(err, ...args) {
                console.error("Error:");
                const clonedError = safeClone(err);
                console.dir(clonedError);
                
                // Registra o ERRO (completa a chamada)
                apiLogger.logError(callId, err);
                
                console.groupEnd();
                return callback.error?.call(this, err, ...args);
            },
            complete(...args) {
                console.log("Complete");
                console.groupEnd();
                return callback.complete?.apply(this, args);
            }
        };
        return original.apply(this, arguments);
    };
});

// ============================================
// COMANDOS DISPONÍVEIS NO CONSOLE
// ============================================

console.log(`
%c🚀 API Logger Iniciado - Uma linha por chamada!
%cComandos disponíveis:

  apiLogger.downloadCSV()           - Baixa um arquivo CSV com os logs
  apiLogger.downloadCSV('nome.csv') - Baixa com nome customizado
  apiLogger.getSummary()            - Retorna resumo dos logs
  apiLogger.printSummary()          - Exibe resumo em tabela
  apiLogger.exportCSV()             - Retorna string CSV (sem download)
  apiLogger.clear()                 - Limpa todos os logs
  apiLogger.logs                    - Acessa array bruto de logs
  
  📊 Estrutura: Uma linha por chamada (request + response/error)
  ✅ Taxa de sucesso automática
  ⏱️ Duração de cada chamada
  📈 Estatísticas em tempo real
`,
"color: #00ff00; font-size: 14px; font-weight: bold;",
"color: #fff; font-size: 12px;"
);