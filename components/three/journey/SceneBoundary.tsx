"use client";

import { Component, type ReactNode } from "react";

/** three/R3F-ийн алдаа хуудсыг унагахгүй — onError дуудаж, SVG fallback руу буцна */
export default class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
