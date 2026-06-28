import { useState, useEffect, useCallback, useContext, useMemo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AuthContext } from "../src/api/context/AuthContext";
import API from "../src/api/api";

const SCORE_LEVELS = [
  { min: 0, max: 20, label: "Débutant", color: "#FF6B6B" },
  { min: 21, max: 40, label: "En construction", color: "#FF9F43" },
  { min: 41, max: 60, label: "En progression", color: "#FACC15" },
  { min: 61, max: 80, label: "Bon profil", color: "#4ADE80" },
  { min: 81, max: 100, label: "Excellent profil", color: "#22D3EE" },
];

// Fallback si l'API ne répond pas (au cas où)
const PARTENAIRES_FALLBACK = [
  { id: "1", name: "Microfinance Soleil", type: "Microfinance", min: 100000, max: 5000000, responseTime: "72 heures", rate: "3.5%/mois" },
  { id: "2", name: "Banque Populaire Congo", type: "Banque", min: 500000, max: 20000000, responseTime: "5 jours", rate: "2.8%/mois" },
  { id: "3", name: "Financement Express", type: "Microfinance", min: 50000, max: 3000000, responseTime: "48 heures", rate: "4%/mois" },
  { id: "4", name: "TrustMicro CG", type: "Microfinance", min: 200000, max: 8000000, responseTime: "96 heures", rate: "3%/mois" },
];

const OBJECTIFS = [
  "Achat de stock",
  "Agrandissement boutique",
  "Nouvel équipement",
  "Nouveau point de vente",
  "Autre",
];

export default function FundingScreen() {
  const navigation = useNavigation<any>();
  const { token } = useContext(AuthContext);

  const [score, setScore] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState<any>(null);
  const [scoreMeta, setScoreMeta] = useState<any>(null);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const [partenaires, setPartenaires] = useState<any[]>(PARTENAIRES_FALLBACK);

  const [simAmount, setSimAmount] = useState("500000");
  const [simDuration, setSimDuration] = useState("12");
  const [simResult, setSimResult] = useState<any>(null);

  const [demandePartenaire, setDemandePartenaire] = useState("");
  const [demandeMontant, setDemandeMontant] = useState("");
  const [demandeObjectif, setDemandeObjectif] = useState(OBJECTIFS[0]);
  const [demandePhone, setDemandePhone] = useState("");
  const [demandeAddress, setDemandeAddress] = useState("");
  const [demandeComment, setDemandeComment] = useState("");
  const [demandeConsent, setDemandeConsent] = useState(false);
  const [demandeSending, setDemandeSending] = useState(false);
  const [demandes, setDemandes] = useState<any[]>([]);
  const [showDemandeModal, setShowDemandeModal] = useState(false);

  const loadScore = useCallback(async () => {
    try {
      const res: any = await API.get("/funding/score");
      setScore(res.data?.score || 0);
      setScoreBreakdown(res.data?.breakdown || null);
      setScoreMeta(res.data?.meta || null);
    } catch {
      setScore(0);
    } finally {
      setScoreLoading(false);
    }
  }, []);

  const loadDemandes = useCallback(async () => {
    try {
      const res: any = await API.get("/funding/demandes");
      setDemandes(res.data?.data || []);
    } catch {
      setDemandes([]);
    }
  }, []);

  const loadPartners = useCallback(async () => {
    try {
      const res: any = await API.get("/funding/partners");
      if (res.data?.partners?.length > 0) {
        setPartenaires(res.data.partners);
      }
    } catch {
      // garde le fallback
    }
  }, []);

  useEffect(() => {
    loadScore();
    loadDemandes();
    loadPartners();
  }, []);

  const level = useMemo(
    () => SCORE_LEVELS.find((l) => score >= l.min && score <= l.max) || SCORE_LEVELS[0],
    [score]
  );

  const runSimulation = useCallback(() => {
    const amount = parseInt(simAmount.replace(/\s/g, ""), 10);
    const months = parseInt(simDuration, 10);
    if (!amount || !months) return;

    const rate = 0.035;
    const monthlyPayment = (amount * (1 + rate * months)) / months;
    const eligible = score >= 40 ? "Bonne" : score >= 20 ? "À améliorer" : "Insuffisante";

    setSimResult({
      monthlyPayment: Math.round(monthlyPayment),
      eligible,
      partners: partenaires.filter(
        (p) => amount >= p.min && amount <= p.max
      ).map((p) => p.name),
    });
  }, [simAmount, simDuration, score]);

  const submitDemande = useCallback(async () => {
    if (!demandeMontant || !demandePhone) {
      Alert.alert("Champs requis", "Remplis au moins le montant et le téléphone");
      return;
    }
    if (!demandeConsent) {
      Alert.alert("Consentement requis", "Tu dois autoriser le partage de tes données financières pour que le partenaire puisse évaluer ta demande.");
      return;
    }
    setDemandeSending(true);
    try {
      await API.post("/funding/demandes", {
        partnerId: demandePartenaire,
        amount: parseInt(demandeMontant.replace(/\s/g, ""), 10),
        objective: demandeObjectif,
        phone: demandePhone,
        address: demandeAddress,
        comment: demandeComment,
        consentGiven: true,
      });
      Alert.alert("Demande envoyée", "Tu seras notifié de l'avancement.");
      setShowDemandeModal(false);
      setDemandeMontant("");
      setDemandePhone("");
      setDemandeAddress("");
      setDemandeComment("");
      setDemandeConsent(false);
      loadDemandes();
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer la demande");
    } finally {
      setDemandeSending(false);
    }
  }, [demandePartenaire, demandeMontant, demandeObjectif, demandePhone, demandeAddress, demandeComment, demandeConsent]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted": return "#4ADE80";
      case "pending": return "#FACC15";
      case "rejected": return "#FF6B6B";
      case "info_required": return "#FF9F43";
      case "closed": return "#666";
      default: return "#A8A3C2";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "accepted": return "Acceptée";
      case "pending": return "En cours";
      case "rejected": return "Refusée";
      case "info_required": return "Infos demandées";
      case "closed": return "Clôturée";
      default: return status;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financement & Opportunités</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* SECTION 1 : MON SCORE */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Ionicons name="trophy-outline" size={22} color={level.color} />
            <Text style={styles.scoreTitle}>Mon Score Commerçant</Text>
          </View>

          {scoreLoading ? (
            <ActivityIndicator color="#8A4DFF" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <View style={styles.scoreCircle}>
                <Text style={[styles.scoreNumber, { color: level.color }]}>{score}</Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>

              <View style={[styles.levelBadge, { backgroundColor: level.color + "20" }]}>
                <Text style={[styles.levelText, { color: level.color }]}>{level.label}</Text>
              </View>

              <View style={styles.scoreDetails}>
                <ScoreRow icon="calendar-outline" label="Ancienneté" value={scoreMeta ? (scoreMeta.monthsActive >= 1 ? `${scoreMeta.monthsActive} mois` : "Moins d'1 mois") : "—"} />
                <ScoreRow icon="checkmark-circle-outline" label="Fiabilité données" value={scoreMeta ? `${100 - scoreMeta.reviewRate}%` : "—"} />
                <ScoreRow icon="time-outline" label="Dernière activité" value={scoreMeta?.lastActivity ? new Date(scoreMeta.lastActivity).toLocaleDateString("fr-FR") : "Jamais"} />
              </View>

              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => setDetailsVisible(true)}
              >
                <Text style={styles.detailBtnText}>Voir les détails</Text>
                <Ionicons name="chevron-forward" size={16} color="#8A4DFF" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* SECTION 2 : MES OPPORTUNITÉS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles-outline" size={20} color="#FACC15" />
            <Text style={styles.sectionTitle}>Mes Opportunités</Text>
          </View>

          <OpportunityCard
            icon="trending-up-outline"
            color="#4ADE80"
            text="Votre score a progressé de 8 points ce mois-ci."
          />
          <OpportunityCard
            icon="shield-checkmark-outline"
            color="#22D3EE"
            text="Votre activité est stable depuis 90 jours."
          />
          <OpportunityCard
            icon="flash-outline"
            color="#FACC15"
            text="Continuez à enregistrer vos ventes pour améliorer votre éligibilité."
          />
          {score >= 70 && (
            <OpportunityCard
              icon="ribbon-outline"
              color="#8A4DFF"
              text="Vous êtes proche du niveau Excellent Profil."
            />
          )}
        </View>

        {/* SECTION 3 : SIMULATION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calculator-outline" size={20} color="#8A4DFF" />
            <Text style={styles.sectionTitle}>Simulation de Financement</Text>
          </View>

          <View style={styles.simCard}>
            <Text style={styles.simLabel}>Montant souhaité (FCFA)</Text>
            <TextInput
              style={styles.simInput}
              value={simAmount}
              onChangeText={setSimAmount}
              keyboardType="numeric"
              placeholder="500 000"
              placeholderTextColor="#555"
            />

            <Text style={styles.simLabel}>Durée (mois)</Text>
            <TextInput
              style={styles.simInput}
              value={simDuration}
              onChangeText={setSimDuration}
              keyboardType="numeric"
              placeholder="12"
              placeholderTextColor="#555"
            />

            <TouchableOpacity style={styles.simBtn} onPress={runSimulation}>
              <Ionicons name="play-outline" size={18} color="#fff" />
              <Text style={styles.simBtnText}>Calculer</Text>
            </TouchableOpacity>

            {simResult && (
              <View style={styles.simResult}>
                <View style={styles.simResultRow}>
                  <Text style={styles.simResultLabel}>Mensualité estimée</Text>
                  <Text style={styles.simResultValue}>
                    {simResult.monthlyPayment.toLocaleString("fr-FR")} FCFA
                  </Text>
                </View>
                <View style={styles.simResultRow}>
                  <Text style={styles.simResultLabel}>Éligibilité estimée</Text>
                  <Text style={[
                    styles.simResultValue,
                    { color: simResult.eligible === "Bonne" ? "#4ADE80" : "#FF9F43" }
                  ]}>
                    {simResult.eligible}
                  </Text>
                </View>
                {simResult.partners.length > 0 && (
                  <View style={styles.simResultRow}>
                    <Text style={styles.simResultLabel}>Partenaires compatibles</Text>
                    <Text style={styles.simResultValue}>
                      {simResult.partners.join(", ")}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* SECTION 4 : PARTENAIRES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="business-outline" size={20} color="#4ADE80" />
            <Text style={styles.sectionTitle}>Partenaires Financiers</Text>
          </View>

          {partenaires.map((p) => (
            <View key={p._id || p.id} style={styles.partnerCard}>
              <View style={styles.partnerHeader}>
                <View style={styles.partnerIcon}>
                  <Ionicons name="business-outline" size={20} color="#8A4DFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>{p.name}</Text>
                  <Text style={styles.partnerType}>{p.type}</Text>
                </View>
              </View>
              <View style={styles.partnerDetails}>
                <View style={styles.partnerDetail}>
                  <Text style={styles.partnerDetailLabel}>Montants</Text>
                  <Text style={styles.partnerDetailValue}>
                    {(p.min / 1000).toFixed(0)}K — {(p.max / 1000).toFixed(0)}K FCFA
                  </Text>
                </View>
                <View style={styles.partnerDetail}>
                  <Text style={styles.partnerDetailLabel}>Réponse moy.</Text>
                  <Text style={styles.partnerDetailValue}>{p.responseTime}</Text>
                </View>
                <View style={styles.partnerDetail}>
                  <Text style={styles.partnerDetailLabel}>Taux</Text>
                  <Text style={styles.partnerDetailValue}>{p.rate}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* SECTION 5 : NOUVELLE DEMANDE */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.newDemandeBtn}
            onPress={() => setShowDemandeModal(true)}
          >
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.newDemandeBtnText}>Nouvelle Demande de Financement</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 6 : MES DEMANDES */}
        {demandes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color="#A8A3C2" />
              <Text style={styles.sectionTitle}>Mes Demandes</Text>
            </View>

            {demandes.map((d, i) => (
              <View key={i} style={styles.demandeCard}>
                <View style={styles.demandeHeader}>
                  <Text style={styles.demandeAmount}>
                    {d.amount?.toLocaleString("fr-FR")} FCFA
                  </Text>
                  <View style={[styles.demandeStatus, { backgroundColor: getStatusColor(d.status) + "20" }]}>
                    <Text style={[styles.demandeStatusText, { color: getStatusColor(d.status) }]}>
                      {getStatusLabel(d.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.demandeMeta}>
                  {d.objective || "Non précisé"} — {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* SECTION 7 : CRÉDITS FOURNISSEURS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="storefront-outline" size={20} color="#FF9F43" />
            <Text style={styles.sectionTitle}>Crédits Fournisseurs</Text>
          </View>
          <View style={styles.comingSoon}>
            <Ionicons name="hourglass-outline" size={32} color="#444" />
            <Text style={styles.comingSoonText}>Bientôt disponible</Text>
            <Text style={styles.comingSoonHint}>
              Des offres de crédit fournisseurs seront prochainement proposées.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL DÉTAILS SCORE */}
      <Modal visible={detailsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails du Score</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {scoreBreakdown ? (
                Object.values(scoreBreakdown).map((item: any, i: number) => (
                  <ScoreDetailRow
                    key={i}
                    label={item.label}
                    points={item.points}
                    max={item.max}
                    desc={
                      item.label === "Régularité d'utilisation" ? "Jours actifs, fréquence ventes & scans" :
                      item.label === "Qualité des données" ? "Cohérence ventes, stock, corrections OCR" :
                      item.label === "Ancienneté" ? "Durée d'utilisation de Vocoshop" :
                      item.label === "Stabilité commerciale" ? "Activité régulière" :
                      item.label === "Gestion du stock" ? "Suivi stock, réapprovisionnement" :
                      "Disponible prochainement"
                    }
                  />
                ))
              ) : (
                <>
                  <ScoreDetailRow label="Régularité d'utilisation" points={0} max={30} desc="Jours actifs, fréquence ventes & scans" />
                  <ScoreDetailRow label="Qualité des données" points={0} max={20} desc="Cohérence ventes, stock, corrections OCR" />
                  <ScoreDetailRow label="Ancienneté" points={0} max={15} desc="Durée d'utilisation de Vocoshop" />
                  <ScoreDetailRow label="Stabilité commerciale" points={0} max={15} desc="Activité régulière" />
                  <ScoreDetailRow label="Gestion du stock" points={0} max={10} desc="Suivi stock, réapprovisionnement" />
                  <ScoreDetailRow label="Historique financier" points={0} max={10} desc="Disponible prochainement" />
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDetailsVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL NOUVELLE DEMANDE */}
      <Modal visible={showDemandeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle Demande</Text>
              <TouchableOpacity onPress={() => setShowDemandeModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.formLabel}>Partenaire</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.partnerSelect}>
                {partenaires.map((p) => (
                  <TouchableOpacity
                    key={p._id || p.id}
                    style={[styles.partnerChip, demandePartenaire === (p._id || p.id) && styles.partnerChipActive]}
                    onPress={() => setDemandePartenaire(p._id || p.id)}
                  >
                    <Text style={[styles.partnerChipText, demandePartenaire === (p._id || p.id) && styles.partnerChipTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.formLabel}>Montant (FCFA)</Text>
              <TextInput
                style={styles.formInput}
                value={demandeMontant}
                onChangeText={setDemandeMontant}
                keyboardType="numeric"
                placeholder="500 000"
                placeholderTextColor="#555"
              />

              <Text style={styles.formLabel}>Objectif</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {OBJECTIFS.map((o) => (
                  <TouchableOpacity
                    key={o}
                    style={[styles.objChip, demandeObjectif === o && styles.objChipActive]}
                    onPress={() => setDemandeObjectif(o)}
                  >
                    <Text style={[styles.objChipText, demandeObjectif === o && styles.objChipTextActive]}>
                      {o}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.formLabel}>Téléphone</Text>
              <TextInput
                style={styles.formInput}
                value={demandePhone}
                onChangeText={setDemandePhone}
                keyboardType="phone-pad"
                placeholder="+242 06 XXX XXX"
                placeholderTextColor="#555"
              />

              <Text style={styles.formLabel}>Adresse</Text>
              <TextInput
                style={styles.formInput}
                value={demandeAddress}
                onChangeText={setDemandeAddress}
                placeholder="Quartier, ville"
                placeholderTextColor="#555"
              />

              <Text style={styles.formLabel}>Commentaire</Text>
              <TextInput
                style={[styles.formInput, { height: 80, textAlignVertical: "top" }]}
                value={demandeComment}
                onChangeText={setDemandeComment}
                multiline
                placeholder="Décris ton besoin..."
                placeholderTextColor="#555"
              />

              <TouchableOpacity
                style={[styles.consentBox, demandeConsent && styles.consentBoxActive]}
                onPress={() => setDemandeConsent(!demandeConsent)}
                activeOpacity={0.7}
              >
                <View style={[styles.consentCheck, demandeConsent && styles.consentCheckActive]}>
                  {demandeConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.consentText}>
                    J'autorise Vocoshop à partager mes données financières (chiffre d'affaires, score, activité) avec le partenaire sélectionné afin d'évaluer ma demande de financement.
                  </Text>
                  <Text style={styles.consentHint}>
                    Conformément à la politique de confidentialité de Vocoshop.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={submitDemande}
                disabled={demandeSending}
              >
                {demandeSending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>Envoyer la demande</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ScoreRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.scoreRow}>
      <Ionicons name={icon as any} size={16} color="#A8A3C2" />
      <Text style={styles.scoreRowLabel}>{label}</Text>
      <Text style={styles.scoreRowValue}>{value}</Text>
    </View>
  );
}

function OpportunityCard({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <View style={[styles.oppCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={styles.oppText}>{text}</Text>
    </View>
  );
}

function ScoreDetailRow({ label, points, max, desc }: { label: string; points: number; max: number; desc: string }) {
  const pct = max > 0 ? (points / max) * 100 : 0;
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowHeader}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowPoints}>{points}/{max}</Text>
      </View>
      <View style={styles.detailBar}>
        <View style={[styles.detailBarFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.detailRowDesc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617" },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  scoreCard: {
    backgroundColor: "#18122B",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  scoreHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  scoreTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  scoreCircle: {
    alignItems: "center",
    marginBottom: 12,
  },
  scoreNumber: { fontSize: 48, fontWeight: "900" },
  scoreMax: { color: "#666", fontSize: 16, fontWeight: "600", marginTop: -4 },
  levelBadge: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  levelText: { fontWeight: "700", fontSize: 14 },
  scoreDetails: { marginBottom: 12 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  scoreRowLabel: { color: "#A8A3C2", fontSize: 13, flex: 1 },
  scoreRowValue: { color: "#fff", fontSize: 13, fontWeight: "600" },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#2A2040",
  },
  detailBtnText: { color: "#8A4DFF", fontSize: 13, fontWeight: "600" },

  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },

  oppCard: {
    backgroundColor: "#18122B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderLeftWidth: 3,
  },
  oppText: { color: "#C6C0DD", fontSize: 13, flex: 1, lineHeight: 18 },

  simCard: {
    backgroundColor: "#18122B",
    borderRadius: 16,
    padding: 16,
  },
  simLabel: { color: "#A8A3C2", fontSize: 12, marginBottom: 6, fontWeight: "600" },
  simInput: {
    backgroundColor: "#120D24",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2040",
  },
  simBtn: {
    backgroundColor: "#8A4DFF",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  simBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  simResult: {
    marginTop: 16,
    backgroundColor: "#120D24",
    borderRadius: 12,
    padding: 14,
  },
  simResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  simResultLabel: { color: "#A8A3C2", fontSize: 13 },
  simResultValue: { color: "#fff", fontSize: 13, fontWeight: "700", flex: 1, textAlign: "right" },

  partnerCard: {
    backgroundColor: "#18122B",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  partnerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  partnerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2A1F50",
    alignItems: "center",
    justifyContent: "center",
  },
  partnerName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  partnerType: { color: "#A8A3C2", fontSize: 11 },
  partnerDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  partnerDetail: { flex: 1 },
  partnerDetailLabel: { color: "#666", fontSize: 10, marginBottom: 2 },
  partnerDetailValue: { color: "#C6C0DD", fontSize: 12, fontWeight: "600" },

  newDemandeBtn: {
    backgroundColor: "#8A4DFF",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  newDemandeBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  demandeCard: {
    backgroundColor: "#18122B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  demandeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  demandeAmount: { color: "#fff", fontSize: 16, fontWeight: "800" },
  demandeStatus: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  demandeStatusText: { fontSize: 11, fontWeight: "700" },
  demandeMeta: { color: "#A8A3C2", fontSize: 12 },

  comingSoon: {
    backgroundColor: "#18122B",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  comingSoonText: { color: "#666", fontSize: 14, fontWeight: "600", marginTop: 8 },
  comingSoonHint: { color: "#444", fontSize: 12, textAlign: "center", marginTop: 4 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#18122B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  modalCloseBtn: {
    backgroundColor: "#2A2040",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  modalCloseBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  detailRow: { marginBottom: 16 },
  detailRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  detailRowLabel: { color: "#fff", fontSize: 14, fontWeight: "600" },
  detailRowPoints: { color: "#8A4DFF", fontSize: 14, fontWeight: "700" },
  detailBar: {
    height: 6,
    backgroundColor: "#2A2040",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  detailBarFill: { height: "100%", backgroundColor: "#8A4DFF", borderRadius: 3 },
  detailRowDesc: { color: "#666", fontSize: 11 },

  formLabel: { color: "#A8A3C2", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  formInput: {
    backgroundColor: "#120D24",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2A2040",
  },
  partnerSelect: { marginBottom: 4 },
  partnerChip: {
    backgroundColor: "#2A2040",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  partnerChipActive: { backgroundColor: "#8A4DFF" },
  partnerChipText: { color: "#A8A3C2", fontSize: 13, fontWeight: "600" },
  partnerChipTextActive: { color: "#fff" },
  objChip: {
    backgroundColor: "#2A2040",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  objChipActive: { backgroundColor: "#8A4DFF" },
  objChipText: { color: "#A8A3C2", fontSize: 12, fontWeight: "600" },
  objChipTextActive: { color: "#fff" },
  submitBtn: {
    backgroundColor: "#8A4DFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 40,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  consentBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#120D24",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#2A2040",
  },
  consentBoxActive: {
    borderColor: "#8A4DFF40",
    backgroundColor: "#8A4DFF10",
  },
  consentCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#555",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  consentCheckActive: {
    backgroundColor: "#8A4DFF",
    borderColor: "#8A4DFF",
  },
  consentText: { color: "#C6C0DD", fontSize: 12, lineHeight: 17 },
  consentHint: { color: "#666", fontSize: 10, marginTop: 4 },
});
