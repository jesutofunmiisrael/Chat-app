import React from 'react'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Phone from './Phone'
import Otp from './Opt';
import SetupProfile from './Setuprofile';
import Chat from './Chat';

const App = () => {
  return (
      <Routes>
      <Route path="/" element={<Phone />} />
    <Route path="/otp" element={<Otp />} />
     <Route path="/setup-profile" element={<SetupProfile />} />
         <Route path="/chat" element={<Chat />} />

    </Routes>

  )
}

export default App
