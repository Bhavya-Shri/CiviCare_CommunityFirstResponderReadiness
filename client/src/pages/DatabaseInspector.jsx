import React, { useState, useEffect } from 'react';
import { Database, Table, Eye, CheckCircle2, RefreshCw, Cpu, Layers, Terminal } from 'lucide-react';
import { apiFetch } from '../api';

export default function DatabaseInspector() {
  const [stats, setStats] = useState(null);
  const [demoQueries, setDemoQueries] = useState(null);
  const [explainResult, setExplainResult] = useState(null);
  const [explainKey, setExplainKey] = useState('active_responders');
  const [loading, setLoading] = useState(false);

  const loadDbInfo = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/db/stats'),
      apiFetch('/db/demo-queries'),
      apiFetch('/db/explain', {
        method: 'POST',
        body: JSON.stringify({ queryKey: explainKey })
      })
    ])
      .then(([statsData, queriesData, explainData]) => {
        setStats(statsData);
        setDemoQueries(queriesData);
        setExplainResult(explainData);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDbInfo();
  }, []);

  const handleRunExplain = async (key) => {
    setExplainKey(key);
    try {
      const res = await apiFetch('/db/explain', {
        method: 'POST',
        body: JSON.stringify({ queryKey: key })
      });
      setExplainResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  const tables = stats?.tableCounts || {};

  return (
    <div className="space-y-6">
      
      {/* Database Highlights Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-warm-border rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase text-warm-slate tracking-wider">Database Engine</div>
          <div className="text-xl font-bold text-ink mt-1">PostgreSQL 16</div>
          <div className="text-[11px] text-warm-slate mt-0.5">ACID Concurrency via MVCC</div>
        </div>

        <div className="bg-white border border-warm-border rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase text-warm-slate tracking-wider">Normalized Tables</div>
          <div className="text-xl font-bold text-ink mt-1">{stats?.totalTables || 19} Tables</div>
          <div className="text-[11px] text-warm-slate mt-0.5">3NF, Foreign Keys & Cascade Rules</div>
        </div>

        <div className="bg-white border border-warm-border rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase text-warm-slate tracking-wider">Database Views</div>
          <div className="text-xl font-bold text-ink mt-1">3 Analytical Views</div>
          <div className="text-[11px] text-warm-slate mt-0.5">v_zone_readiness_summary</div>
        </div>

        <div className="bg-white border border-warm-border rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase text-warm-slate tracking-wider">Isolation Level</div>
          <div className="text-xl font-bold text-civicgreen mt-1">Serializable Isolation</div>
          <div className="text-[11px] text-warm-slate mt-0.5">Zero Double-Booking Collisions</div>
        </div>
      </div>

      {/* Relational Table Record Counts */}
      <div className="bg-white border border-warm-border rounded-lg p-5">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-ink">PostgreSQL Relational Schema Catalog</h3>
          <p className="text-xs text-warm-slate mt-0.5">Current record counts across all core normalized database relations</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {Object.entries(tables).map(([tableName, count]) => (
            <div key={tableName} className="p-2.5 rounded border border-warm-border bg-warm-bg/40 text-xs">
              <div className="font-mono text-warm-slate text-[10px] truncate" title={tableName}>
                {tableName}
              </div>
              <div className="text-base font-bold text-ink mt-0.5">{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* EXPLAIN Execution Plan Inspector */}
      <div className="bg-white border border-warm-border rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink">PostgreSQL EXPLAIN Execution Plan Inspector</h3>
            <p className="text-xs text-warm-slate mt-0.5">
              Analyzes execution cost, index scans, and sequential scan performance
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'active_responders', label: 'Active Responders View' },
              { key: 'zone_readiness', label: 'Zone Readiness Aggregate' },
              { key: 'incident_history', label: 'Incidents with Assignments' }
            ].map((q) => (
              <button
                key={q.key}
                onClick={() => handleRunExplain(q.key)}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  explainKey === q.key
                    ? 'bg-ink text-white font-medium'
                    : 'bg-warm-bg text-warm-slate hover:text-ink border border-warm-border'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {explainResult && (
          <div className="space-y-3 pt-2">
            <div className="p-3 bg-warm-bg rounded border border-warm-border text-xs font-mono text-ink overflow-x-auto">
              <div className="text-[10px] uppercase font-bold text-warm-slate mb-1">Executed SQL:</div>
              <div>{explainResult.query}</div>
            </div>

            <div className="p-3 bg-ink text-warm-bg rounded font-mono text-[11px] overflow-x-auto leading-relaxed">
              <div className="text-[10px] uppercase text-warm-slate mb-1">Query Execution Plan (EXPLAIN):</div>
              {explainResult.plan?.map((line, idx) => (
                <div key={idx} className="whitespace-pre">
                  {typeof line === 'string' ? line : JSON.stringify(line)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
