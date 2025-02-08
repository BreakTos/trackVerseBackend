"use client";
import { useState, useEffect } from 'react';
import { useAccount, useContract, useProvider, useSigner } from 'wagmi';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/constants';

export default function Home() {
  const [creators, setCreators] = useState<string[]>([]);
  const [tipAmount, setTipAmount] = useState('');
  const { address } = useAccount();
  const provider signer } = useSigner();

  const contract = useContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    signerOrProvider: signer || provider,
  });

  useEffect(() => {
    loadCreators();
  }, []);

  async function loadCreators() {
    if (contract) {
      const allCreators = await contract.getAllCreators();
      setCreators(allCreators);
    }
  }

  async function registerAsCreator() {
    if (contract && signer) {
      try {
        const tx = await contract.registerCreator();
        await tx.wait();
        await loadCreators();
      } catch (error) {
        console.error('Error registering:', error);
      }
    }
  }

  async function sendTip(creatorAddress: string) {
    if (contract && signer) {
      try {
        const amount = ethers.utils.parseEther(tipAmount);
        const tx = await contract.tipCreator(creatorAddress, amount);
        await tx.wait();
      } catch (error) {
        console.error('Error tipping:', error);
      }
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Social Tipping Platform</h1>
      
      <button
        onClick={registerAsCreator}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Register as Creator
      </button>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Creators</h2>
        {creators.map((creator) => (
          <div key={creator} className="border p-4 mb-4 rounded">
            <p>Creator: {creator}</p>
            <input
              type="text"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              placeholder="Amount in ETH"
              className="border p-2 mr-2"
            />
            <button
              onClick={() => sendTip(creator)}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Send Tip
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}