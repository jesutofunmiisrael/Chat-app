import { useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../src/api";
import "./Otp.css";

export default function Otp() {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();

  const { phoneNumber, otp } = location.state || {};

 
  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;

    const updated = [...digits];
    updated[index] = value;
    setDigits(updated);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") handleVerify();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    const updated = ["", "", "", ""];
    pasted.split("").forEach((ch, i) => (updated[i] = ch));
    setDigits(updated);
    inputRefs.current[Math.min(pasted.length, 3)]?.focus();
    e.preventDefault();
  };

  const handleVerify = async () => {
    const otpInput = digits.join("");

    if (otpInput.length < 4) {
      toast.error("Enter the complete 4-digit OTP");
      return;
    }

    const id = toast.loading("Verifying...");

    try {
      await api.post("/auth/verify-otp", { phoneNumber, otp: otpInput });

      toast.success("OTP verified", { id });

      try {
        const userRes = await api.get(`/users/${phoneNumber}`);
        localStorage.setItem("chatUser", JSON.stringify(userRes.data.data));
        navigate("/chat");
      } catch {
        navigate("/setup-profile", { state: { phoneNumber } });
      }
    } catch {
      toast.error("Invalid OTP", { id });
    }
  };

  const handleResend = async () => {
    const id = toast.loading("Resending OTP...");
    try {
      await api.post("/auth/send-otp", { phoneNumber });
      toast.success("OTP resent", { id });
      setDigits(["", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      toast.error("Failed to resend OTP", { id });
    }
  };

  return (
    <div className="otp-container">
      <div className="otp-card">

        <h2 className="otp-title">Verify OTP</h2>
        <p className="otp-subtitle">Enter the 4-digit code sent to</p>
        <p className="otp-phone">OTP: {otp}</p>

      
        <div className="otp-boxes">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              className="otp-box"
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              autoFocus={i === 0}
            />
          ))}
        </div>


        <button className="otp-resend" onClick={handleResend}>
          Resend OTP
        </button>

   
        <button className="otp-button" onClick={handleVerify}>
          Verify
        </button>

      </div>
    </div>
  );
}