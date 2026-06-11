import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

interface QuantityModalProps {
  visible: boolean;
  initialValue?: number;
  productName?: string;
  onValidate: (quantity: number) => void;
  onCancel: () => void;
}

const QuantityModal: React.FC<QuantityModalProps> = ({
  visible,
  initialValue = 0,
  productName,
  onValidate,
  onCancel,
}) => {
  const [quantity, setQuantity] = useState(initialValue);

  const handleValidate = () => {
    onValidate(quantity);
  };

  const handleCancel = () => {
    setQuantity(initialValue);
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{productName ? `Quantité pour ${productName}` : "Entrer la quantité"}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(quantity)}
            onChangeText={v => setQuantity(Number(v.replace(/[^0-9]/g, "")))}
            placeholder="Quantité"
            placeholderTextColor="#aaa"
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={handleCancel}>
              <Text style={styles.btnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.validate]} onPress={handleValidate}>
              <Text style={styles.btnText}>Valider</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: 300,
    alignItems: "center",
  },
  title: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 18,
    color: "#222",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    width: "100%",
    fontSize: 16,
    marginBottom: 18,
    color: "#222",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  btn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  cancel: {
    backgroundColor: "#eee",
  },
  validate: {
    backgroundColor: "#8A4DFF",
  },
  btnText: {
    color: "#222",
    fontWeight: "bold",
  },
});

export default QuantityModal;
