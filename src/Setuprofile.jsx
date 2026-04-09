import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../src/api";
import "./Setuprofile.css";

export default function SetupProfile() {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");

  const navigate = useNavigate();
  const location = useLocation();

  const { phoneNumber } = location.state || {};

  const generateAvatar = (name, gender) => {
    if (gender === "female") {
      return `https://avatar.iran.liara.run/public/girl?username=${name}`;
    }
    return `https://avatar.iran.liara.run/public/boy?username=${name}`;
  };

  // Show first letter of name, or a default "?" if name is empty
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Enter your name");
      return;
    }

    const id = toast.loading("Creating profile...");

    try {
      const profilePic = generateAvatar(name, gender);

      const res = await api.post("/users/register", {
        phoneNumber,
        name,
        gender,
        profilePic,
      });

      localStorage.setItem("chatUser", JSON.stringify(res.data.data));

      toast.success("Profile created", { id });

      navigate("/chat");
    } catch {
      toast.error("Failed to create profile", { id });
    }
  };

  return (
    <div className="sp-container">
      <div className="sp-card">

        <h2 className="sp-title">Setup Your Profile</h2>
        <p className="sp-subtitle">Tell us a bit about yourself</p>


        <div className="sp-avatar-wrapper">
          {name.trim() ? (
            <img
              className="sp-avatar-img"
              src={generateAvatar(name, gender)}
              alt="avatar"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span className="sp-avatar-initial">{initial}</span>
          )}
        </div>

  
        <div className="sp-field">
          <label className="sp-label">Name</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="sp-input"
          />
        </div>

        <div className="sp-field">
          <label className="sp-label">Gender</label>
          <div className="sp-select-wrapper">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="sp-select"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <button className="sp-button" onClick={handleSubmit}>
          Continue
        </button>

      </div>
    </div>
  );
}