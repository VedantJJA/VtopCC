import React, { useState, useMemo } from 'react';
import CryptoJS from 'crypto-js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { Shield, LockOpen, Loader2, Search, ChevronDown, Mail, Phone, Lock } from 'lucide-react';

// Firebase configuration from your old project
const firebaseConfig = {
    apiKey: "AIzaSyBsdpGsNO3y6a0EapBakU1cS6WC0pEoXSU",
    authDomain: "vitc29.firebaseapp.com",
    projectId: "vitc29",
    storageBucket: "vitc29.firebasestorage.app",
    messagingSenderId: "376204861458",
    appId: "1:376204861458:web:5dc7fdaa74f2650911f8cb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const StudentDirectory: React.FC = () => {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [password, setPassword] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [error, setError] = useState('');
    
    const [searchQuery, setSearchQuery] = useState('');
    const [decryptedList, setDecryptedList] = useState<any[]>([]);
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    const handleUnlock = async () => {
        if (!password) {
            setError("Please enter the password.");
            return;
        }

        setIsUnlocking(true);
        setError('');

        try {
            const key = CryptoJS.SHA256(password);
            const querySnapshot = await getDocs(collection(db, "encrypted_students"));
            
            const tempStudentList: any[] = [];
            let successCount = 0;

            querySnapshot.forEach((doc) => {
                try {
                    const data = doc.data();
                    const decrypted = CryptoJS.AES.decrypt(data.blob, key, { 
                        mode: CryptoJS.mode.ECB, 
                        padding: CryptoJS.pad.Pkcs7 
                    });
                    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
                    
                    if (jsonString && jsonString.startsWith('{')) {
                        const student = JSON.parse(jsonString);
                        student._searchStr = `${student.Name} ${student.RegNo} ${student.Mail} ${student.Mobile}`.toLowerCase();
                        tempStudentList.push(student);
                        successCount++;
                    }
                } catch (e) {
                    // Ignore individual decryption errors to continue processing others
                }
            });

            if (successCount === 0) {
                setError("Unlock Failed: Incorrect Password or empty database.");
                setIsUnlocking(false);
                return;
            }

            setDecryptedList(tempStudentList);
            setIsUnlocked(true);
            setPassword('');
        } catch (err: any) {
            setError(err.message || "Failed to connect database.");
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleLock = () => {
        setDecryptedList([]);
        setIsUnlocked(false);
        setSearchQuery('');
    };

    const searchResults = useMemo(() => {
        const term = searchQuery.toLowerCase().trim();
        if (term.length < 2) return [];
        return decryptedList.filter(s => s._searchStr.includes(term)).slice(0, 10);
    }, [searchQuery, decryptedList]);

    return (
        <div className="bg-bgCard rounded-xl p-6 shadow-sm border border-borderColor max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold text-textMain mb-4 flex items-center">
                <Shield className="h-6 w-6 mr-2 text-blue-500" /> Secure Student Directory
            </h3>

            {!isUnlocked ? (
                <div className="space-y-4">
                    <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 mb-4 rounded-r-lg">
                        <p className="text-sm text-amber-500 font-medium">
                            This directory is encrypted and only for admin use. Please enter the master password to unlock.
                        </p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Master Password</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                            className="w-full p-2.5 rounded-lg border border-borderColor bg-bgPrimary text-textMain focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Enter decryption key"
                        />
                    </div>
                    
                    {error && <p className="text-rose-500 text-sm font-semibold">{error}</p>}

                    <button 
                        onClick={handleUnlock}
                        disabled={isUnlocking}
                        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
                    >
                        {isUnlocking ? (
                            <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Unlocking & Syncing...</>
                        ) : (
                            <><LockOpen className="h-4 w-4 mr-2" /> Unlock Directory</>
                        )}
                    </button>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                        <span className="text-xs font-mono font-bold text-emerald-500 flex items-center">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                            Decryption Key Active
                        </span>
                        <button 
                            onClick={handleLock}
                            className="text-xs text-textMuted hover:text-textMain hover:underline font-medium flex items-center gap-1"
                        >
                            <Lock className="h-3 w-3" /> Lock Directory
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Search Student</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted" />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full p-2.5 pl-10 rounded-lg border border-borderColor bg-bgPrimary text-textMain focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="RegNo, Email, or Mobile"
                            />
                        </div>
                    </div>

                    <div className="mt-4 space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                        {searchQuery.length >= 2 && searchResults.length === 0 && (
                            <div className="p-3 text-textMuted text-sm text-center bg-bgPrimary rounded-lg border border-borderColor">
                                No matches found.
                            </div>
                        )}

                        {searchResults.map((student) => (
                            <div 
                                key={student.RegNo}
                                onClick={() => setExpandedCard(expandedCard === student.RegNo ? null : student.RegNo)}
                                className="bg-bgCard border border-borderColor rounded-lg p-4 shadow-sm hover:border-blue-500/50 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-textMain text-base">{student.Name}</h4>
                                        <p className="text-sm text-textMuted mt-0.5">{student.RegNo}</p>
                                    </div>
                                    <ChevronDown 
                                        className={`w-5 h-5 text-textMuted group-hover:text-blue-500 transition-transform duration-200 ${expandedCard === student.RegNo ? 'rotate-180' : ''}`} 
                                    />
                                </div>
                                
                                {expandedCard === student.RegNo && (
                                    <div className="mt-4 pt-3 border-t border-borderColor/60 text-sm space-y-2 animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center text-textMain">
                                            <Mail className="w-4 h-4 mr-2 text-textMuted" />
                                            <span>{student.Mail || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center text-textMain">
                                            <Phone className="w-4 h-4 mr-2 text-textMuted" />
                                            <span>{student.Mobile || 'N/A'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};