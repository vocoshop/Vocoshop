// src/api/components/SyncIndicator.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { onSyncState } from "../offline/syncEngine";
import { getFailedJobsUI, retryAllFailedJobs, clearAllFailedJobs, forceSync } from "../offline/syncEngine";

export default function SyncIndicator() {
  const [syncing, setSyncing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [showFailed, setShowFailed] = useState(false);
  const [failedJobs, setFailedJobs] = useState<any[]>([]);

  const fade = useRef(new Animated.Value(0)).current;

  /* =====================================================
  LISTENER SYNC ENGINE
  ===================================================== */
  useEffect(() => {
    const unsub = onSyncState((s) => {
      setSyncing(s.syncing);
      setQueueSize(s.queueSize);
      setFailedCount(s.failed);
      setPendingCount(s.pending);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  /* =====================================================
  LOAD FAILED JOBS
  ===================================================== */
  useEffect(() => {
    const loadFailed = async () => {
      const jobs = await getFailedJobsUI();
      setFailedJobs(jobs);
    };
    loadFailed();
    const interval = setInterval(loadFailed, 5000);
    return () => clearInterval(interval);
  }, []);

  /* =====================================================
  ANIMATION
  ===================================================== */
  useEffect(() => {
    const shouldShow = syncing || queueSize > 0 || failedCount > 0;
    Animated.timing(fade, {
      toValue: shouldShow ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [syncing, queueSize, failedCount]);

  /* =====================================================
  HIDE IF NOTHING
  ===================================================== */
  if (!syncing && queueSize === 0 && failedCount === 0) return null;

  /* =====================================================
  FAILED JOBS PANEL
  ===================================================== */
  if (showFailed) {
    return (
      <View style={styles.failedPanel}>
        <View style={styles.failedHeader}>
          <View style={styles.failedTitle}>
            <Ionicons name="warning" size={16} color="#F59E0B" />
            <Text style={styles.failedTitleText}>Actions échouées</Text>
            <Text style={styles.failedCount}>{failedCount}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowFailed(false)}>
            <Ionicons name="close" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {failedJobs.length === 0 ? (
          <Text style={styles.emptyText}>Aucune action échouée</Text>
        ) : (
          <View style={styles.failedList}>
            {failedJobs.slice(0, 5).map((job) => (
              <View key={job.id} style={styles.failedItem}>
                <View style={styles.failedItemInfo}>
                  <Text style={styles.failedItemTitle}>{job.title || job.url}</Text>
                  <Text style={styles.failedItemError}>{job.lastError}</Text>
                  <Text style={styles.failedItemTries}>Tentatives: {job.tries}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.failedActions}>
          <TouchableOpacity
            style={styles.failedBtn}
            onPress={async () => {
              await retryAllFailedJobs();
              setShowFailed(false);
            }}
          >
            <Ionicons name="refresh" size={14} color="#22C55E" />
            <Text style={styles.failedBtnText}>Tout réessayer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.failedBtn, styles.failedBtnDanger]}
            onPress={async () => {
              await clearAllFailedJobs();
              setShowFailed(false);
            }}
          >
            <Ionicons name="trash" size={14} color="#EF4444" />
            <Text style={[styles.failedBtnText, { color: "#EF4444" }]}>Supprimer tout</Text>
          </TouchableOpacity>
        </View>

        {failedCount > 5 && (
          <Text style={styles.moreText}>+{failedCount - 5} autres actions</Text>
        )}
      </View>
    );
  }

  /* =====================================================
  SYNC INDICATOR
  ===================================================== */
  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      {syncing ? (
        <>
          <Animated.View style={styles.spinningIcon}>
            <Ionicons name="sync" size={16} color="#22C55E" />
          </Animated.View>
          <Text style={[styles.text, { color: "#22C55E" }]}>Sync...</Text>
        </>
      ) : failedCount > 0 ? (
        <TouchableOpacity style={styles.failedBadge} onPress={() => setShowFailed(true)}>
          <Ionicons name="warning" size={14} color="#F59E0B" />
          <Text style={[styles.text, { color: "#F59E0B" }]}>
            {failedCount} échoué{failedCount > 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <Ionicons name="cloud-done-outline" size={14} color="#9CA3AF" />
          <Text style={styles.text}>
            En attente ({pendingCount})
          </Text>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 55,
    alignSelf: "center",
    backgroundColor: "#1E1638",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    zIndex: 999,
  },
  spinningIcon: {
    opacity: 0.7,
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  failedBadge: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  failedPanel: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    backgroundColor: "#1E1638",
    borderRadius: 14,
    padding: 14,
    width: 280,
    zIndex: 999,
    borderWidth: 1,
    borderColor: "#F59E0B40",
  },
  failedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  failedTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  failedTitleText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  failedCount: {
    backgroundColor: "#F59E0B",
    color: "#000",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12,
  },
  failedList: {
    maxHeight: 150,
    overflow: "hidden",
  },
  failedItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  failedItemInfo: {
    gap: 2,
  },
  failedItemTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  failedItemError: {
    color: "#EF4444",
    fontSize: 11,
  },
  failedItemTries: {
    color: "#9CA3AF",
    fontSize: 10,
  },
  failedActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },
  failedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#22C55E20",
  },
  failedBtnDanger: {
    backgroundColor: "#EF444420",
  },
  failedBtnText: {
    color: "#22C55E",
    fontSize: 11,
    fontWeight: "600",
  },
  moreText: {
    color: "#9CA3AF",
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
  },
});