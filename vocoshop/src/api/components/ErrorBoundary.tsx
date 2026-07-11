import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.log("🚨 CRASH:", error.message, errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>🚨 L'application a planté</Text>
          <Text style={styles.subtitle}>Erreur:</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.error}>{this.state.error?.message}</Text>
            <Text style={styles.stack}>{this.state.errorInfo?.componentStack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a1a", justifyContent: "center", alignItems: "center", padding: 20 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#aaa", fontSize: 16, marginBottom: 12 },
  scroll: { width: "100%", maxHeight: 300 },
  error: { color: "#f88", fontSize: 14, marginBottom: 8 },
  stack: { color: "#888", fontSize: 11 },
});
