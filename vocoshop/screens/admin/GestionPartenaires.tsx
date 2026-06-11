import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import API from "../../src/api/api";

interface Partner {
  _id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  min: number;
  max: number;
  responseTime: string;
  rate: string;
  active: boolean;
  order: number;
}

const EMPTY_PARTNER: Partner = {
  _id: "",
  name: "",
  type: "Microfinance",
  email: "",
  phone: "",
  min: 0,
  max: 0,
  responseTime: "",
  rate: "",
  active: true,
  order: 0,
};

export default function GestionPartenaires() {
  const navigation = useNavigation<any>();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Partner>(EMPTY_PARTNER);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await API.get("/admin/partners");
      setPartners(res.data?.partners || []);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les partenaires");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing({ ...EMPTY_PARTNER });
    setIsEdit(false);
    setModalVisible(true);
  };

  const openEdit = (p: Partner) => {
    setEditing({ ...p });
    setIsEdit(true);
    setModalVisible(true);
  };

  const save = async () => {
    if (!editing.name.trim() || !editing.email.trim()) {
      Alert.alert("Champs requis", "Nom et email sont obligatoires");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await API.put(`/admin/partners/${editing._id}`, editing);
      } else {
        await API.post("/admin/partners", editing);
      }
      setModalVisible(false);
      load();
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  };

  const remove = (p: Partner) => {
    Alert.alert(
      "Supprimer",
      `Supprimer "${p.name}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await API.delete(`/admin/partners/${p._id}`);
              load();
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer");
            }
          },
        },
      ]
    );
  };

  const toggleActive = async (p: Partner) => {
    try {
      await API.put(`/admin/partners/${p._id}`, { active: !p.active });
      load();
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8A4DFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des Partenaires Financiers</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle" size={28} color="#8A4DFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {partners.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={48} color="#4A4464" />
            <Text style={styles.emptyText}>Aucun partenaire</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
              <Text style={styles.addBtnText}>+ Ajouter un partenaire</Text>
            </TouchableOpacity>
          </View>
        ) : (
          partners.map((p) => (
            <View key={p._id} style={[styles.card, !p.active && styles.cardInactive]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{p.name}</Text>
                  <Text style={styles.cardType}>{p.type}</Text>
                </View>
                <Switch
                  value={p.active}
                  onValueChange={() => toggleActive(p)}
                  trackColor={{ false: "#333", true: "#4ADE80" }}
                  thumbColor={p.active ? "#fff" : "#666"}
                />
              </View>

              <View style={styles.cardDetails}>
                <View style={styles.cardDetail}>
                  <Ionicons name="mail-outline" size={14} color="#8B83A8" />
                  <Text style={styles.cardDetailText}>{p.email}</Text>
                </View>
                {p.phone ? (
                  <View style={styles.cardDetail}>
                    <Ionicons name="call-outline" size={14} color="#8B83A8" />
                    <Text style={styles.cardDetailText}>{p.phone}</Text>
                  </View>
                ) : null}
                <View style={styles.cardDetail}>
                  <Ionicons name="cash-outline" size={14} color="#8B83A8" />
                  <Text style={styles.cardDetailText}>
                    {(p.min / 1000).toFixed(0)}K — {(p.max / 1000).toFixed(0)}K FCFA
                  </Text>
                </View>
                <View style={styles.cardDetail}>
                  <Ionicons name="time-outline" size={14} color="#8B83A8" />
                  <Text style={styles.cardDetailText}>{p.responseTime} · {p.rate}</Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(p)}>
                  <Ionicons name="pencil-outline" size={16} color="#A78BFA" />
                  <Text style={styles.editBtnText}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => remove(p)}>
                  <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                  <Text style={styles.deleteBtnText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* MODAL ÉDITION / CRÉATION */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEdit ? "Modifier le partenaire" : "Nouveau partenaire"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Nom *</Text>
              <TextInput
                style={styles.input}
                value={editing.name}
                onChangeText={(t) => setEditing({ ...editing, name: t })}
                placeholder="Microfinance Soleil"
                placeholderTextColor="#555"
              />

              <Text style={styles.label}>Type</Text>
              <View style={styles.chipRow}>
                {["Microfinance", "Banque", "Financement"].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, editing.type === t && styles.chipActive]}
                    onPress={() => setEditing({ ...editing, type: t })}
                  >
                    <Text style={[styles.chipText, editing.type === t && styles.chipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Email * (pour envoi des demandes)</Text>
              <TextInput
                style={styles.input}
                value={editing.email}
                onChangeText={(t) => setEditing({ ...editing, email: t })}
                placeholder="contact@microfinance.cg"
                placeholderTextColor="#555"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={editing.phone}
                onChangeText={(t) => setEditing({ ...editing, phone: t })}
                placeholder="+242 06 XXX XXX"
                placeholderTextColor="#555"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Montant min (FCFA)</Text>
              <TextInput
                style={styles.input}
                value={String(editing.min || "")}
                onChangeText={(t) => setEditing({ ...editing, min: parseInt(t) || 0 })}
                placeholder="100000"
                placeholderTextColor="#555"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Montant max (FCFA)</Text>
              <TextInput
                style={styles.input}
                value={String(editing.max || "")}
                onChangeText={(t) => setEditing({ ...editing, max: parseInt(t) || 0 })}
                placeholder="5000000"
                placeholderTextColor="#555"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Délai de réponse</Text>
              <TextInput
                style={styles.input}
                value={editing.responseTime}
                onChangeText={(t) => setEditing({ ...editing, responseTime: t })}
                placeholder="72 heures"
                placeholderTextColor="#555"
              />

              <Text style={styles.label}>Taux d'intérêt</Text>
              <TextInput
                style={styles.input}
                value={editing.rate}
                onChangeText={(t) => setEditing({ ...editing, rate: t })}
                placeholder="3.5%/mois"
                placeholderTextColor="#555"
              />

              <Text style={styles.label}>Ordre d'affichage</Text>
              <TextInput
                style={styles.input}
                value={String(editing.order || "")}
                onChangeText={(t) => setEditing({ ...editing, order: parseInt(t) || 0 })}
                placeholder="1"
                placeholderTextColor="#555"
                keyboardType="numeric"
              />

              <View style={styles.switchRow}>
                <Text style={styles.label}>Actif</Text>
                <Switch
                  value={editing.active}
                  onValueChange={(v) => setEditing({ ...editing, active: v })}
                  trackColor={{ false: "#333", true: "#4ADE80" }}
                  thumbColor={editing.active ? "#fff" : "#666"}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={save}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {isEdit ? "Enregistrer" : "Créer"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0A0617" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: "#13101E",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  list: { flex: 1, padding: 16 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#6B6589", fontSize: 14, marginTop: 12 },
  addBtn: { marginTop: 16, backgroundColor: "#8A4DFF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  card: {
    backgroundColor: "#18122B", borderWidth: 1, borderColor: "rgba(255,255,255,.06)",
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  cardInactive: { opacity: 0.5 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "800", color: "#fff" },
  cardType: { fontSize: 12, color: "#A78BFA", marginTop: 2 },
  cardDetails: { marginTop: 10 },
  cardDetail: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  cardDetailText: { fontSize: 12, color: "#8B83A8" },
  cardActions: { flexDirection: "row", gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.06)", paddingTop: 10 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  editBtnText: { fontSize: 12, color: "#A78BFA", fontWeight: "700" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  deleteBtnText: { fontSize: 12, color: "#FF6B6B", fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#18122B", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.06)",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  modalBody: { padding: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#8B83A8", marginBottom: 6, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)",
    borderRadius: 10, padding: 12, fontSize: 14, color: "#fff",
  },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)",
  },
  chipActive: { backgroundColor: "rgba(138,77,255,.2)", borderColor: "#8A4DFF" },
  chipText: { fontSize: 13, color: "#8B83A8", fontWeight: "600" },
  chipTextActive: { color: "#A78BFA" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  modalFooter: {
    flexDirection: "row", gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.06)",
  },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: "center",
    backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)",
  },
  cancelBtnText: { color: "#8B83A8", fontWeight: "700", fontSize: 14 },
  saveBtn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: "center",
    backgroundColor: "#8A4DFF",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
