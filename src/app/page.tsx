'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import './animations.css';

interface SoundCard {
  id: number;
  soundId: number;
  isFlipped: boolean;
  isMatched: boolean;
  flipCount: number; // Flip counter
}

const SoundMemoryGame = () => {
  const [level, setLevel] = useState(1);
  const [cards, setCards] = useState<SoundCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false); // Game over state
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate the number of pairs for the current level
  const getPairsCount = useCallback((currentLevel: number) => {
    return Math.min(currentLevel + 1, 32); // Maximum 32 pairs (8x8)
  }, []);

  // Generate sounds for the current level
  const generateSounds = useCallback((pairsCount: number) => {
    const sounds = Array.from({ length: pairsCount }, (_, i) => i);
    return [...sounds, ...sounds]; // Duplicate to create pairs
  }, []);

  // Shuffle cards
  const shuffleCards = useCallback((soundIds: number[]) => {
    const shuffled = [...soundIds]
      .sort(() => Math.random() - 0.5)
      .map((soundId, index) => ({
        id: index,
        soundId,
        isFlipped: false,
        isMatched: false,
        flipCount: 0, // Initialize counter to 0
      }));
    return shuffled;
  }, []);

  // Play sound with the same timbre but different pitches
  const playSound = useCallback((soundId: number) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Use only 'sine' waveform for constant timbre
      oscillator.type = 'sine';
      
      // Base frequencies for a complete octave (C major)
      const baseFrequencies = [
        261.63, // C4
        293.66, // D4
        329.63, // E4
        349.23, // F4
        392.00, // G4
        440.00, // A4
        493.88, // B4
        523.25, // C5
        587.33, // D5
        659.25, // E5
        698.46, // F5
        783.99, // G5
        880.00, // A5
        987.77, // B5
        1046.50, // C6
        1174.66, // D6
      ];
      
      // Calculate frequency based on soundId
      const frequency = baseFrequencies[soundId % baseFrequencies.length];
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      
      // Create sound envelope with soft attack
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1.2);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, []);

  // Manage timer
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setIsPlaying(true);
    setTime(0);
    
    timerRef.current = setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Initialize game
  const initializeGame = useCallback(() => {
    stopTimer();
    
    const pairsCount = getPairsCount(level);
    const soundIds = generateSounds(pairsCount);
    const shuffledCards = shuffleCards(soundIds);
    
    setCards(shuffledCards);
    setFlippedCards([]);
    setMatchedPairs(0);
    setMoves(0);
    setGameComplete(false);
    setGameOver(false); // Reset game over state
    setTime(0);
    
    // Start timer after short delay
    setTimeout(startTimer, 500);
  }, [level, getPairsCount, generateSounds, shuffleCards, stopTimer, startTimer]);

  // Handle card click
  const handleCardClick = useCallback((cardId: number) => {
    if (isChecking || gameComplete || gameOver || !isPlaying) return;
    
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;
    
    // Check if card has already been flipped 5 times
    if (card.flipCount >= 5) {
      // Player lost!
      stopTimer();
      setGameOver(true);
      return;
    }
    
    // Play sound
    playSound(card.soundId);
    
    // Flip card and increment counter
    const newCards = cards.map(c => 
      c.id === cardId ? { ...c, isFlipped: true, flipCount: c.flipCount + 1 } : c
    );
    setCards(newCards);
    
    const updatedCard = newCards.find(c => c.id === cardId);
    
    // Check if it's the 5th flip
    if (updatedCard && updatedCard.flipCount === 5) {
      // If it's the first flipped card and another is flipped, it's game over
      if (flippedCards.length === 0) {
        // Wait for player to flip another card
        const newFlippedCards = [...flippedCards, cardId];
        setFlippedCards(newFlippedCards);
        return;
      }
      // If it's the second card, continue normal logic
    }
    
    const newFlippedCards = [...flippedCards, cardId];
    setFlippedCards(newFlippedCards);
    
    // Check if two cards are flipped
    if (newFlippedCards.length === 2) {
      setIsChecking(true);
      setMoves(moves + 1);
      
      const card1 = newCards.find(c => c.id === newFlippedCards[0]);
      const card2 = newCards.find(c => c.id === newFlippedCards[1]);
      
      // Check if any card is on its 5th flip
      const isFifthFlipCard1 = card1 && card1.flipCount === 5;
      const isFifthFlipCard2 = card2 && card2.flipCount === 5;
      
      if (card1 && card2 && card1.soundId === card2.soundId) {
        // Pair found!
        setTimeout(() => {
          const updatedCards = newCards.map(c => 
            c.id === card1.id || c.id === card2.id ? { ...c, isMatched: true } : c
          );
          setCards(updatedCards);
          setFlippedCards([]);
          setIsChecking(false);
          
          const newMatchedPairs = matchedPairs + 1;
          setMatchedPairs(newMatchedPairs);
          
          // Check if level is complete
          if (newMatchedPairs === getPairsCount(level)) {
            stopTimer();
            
            // Update best score
            const score = moves + time;
            if (bestScore === null || score < bestScore) {
              setBestScore(score);
            }
            
            if (level < 31) { // Maximum 8x8 = 64 cards = 32 pairs
              setTimeout(() => {
                setLevel(level + 1);
              }, 800); // Reduced from 1500ms to 800ms
            } else {
              setGameComplete(true);
            }
          }
        }, 600); // Reduced from 1000ms to 600ms
      } else {
        // Not a pair - check if lost due to 5th flip
        if (isFifthFlipCard1 || isFifthFlipCard2) {
          // Player lost due to 5th flip!
          setTimeout(() => {
            stopTimer();
            setGameOver(true);
          }, 300);
        } else {
          // Flip cards back normally
          setTimeout(() => {
            const updatedCards = newCards.map(c => 
              newFlippedCards.includes(c.id) ? { ...c, isFlipped: false } : c
            );
            setCards(updatedCards);
            setFlippedCards([]);
            setIsChecking(false);
          }, 600); // Reduced from 1200ms to 600ms
        }
      }
    }
  }, [cards, flippedCards, matchedPairs, level, moves, isChecking, gameComplete, gameOver, isPlaying, playSound, getPairsCount, stopTimer, bestScore, time]);

  // Calculate grid size
  const getGridSize = useCallback(() => {
    const totalCards = cards.length;
    if (totalCards <= 4) return 'grid-cols-2';
    if (totalCards <= 9) return 'grid-cols-3';
    if (totalCards <= 16) return 'grid-cols-4';
    if (totalCards <= 25) return 'grid-cols-5';
    if (totalCards <= 36) return 'grid-cols-6';
    if (totalCards <= 49) return 'grid-cols-7';
    return 'grid-cols-8';
  }, [cards.length]);

  // Format time
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Initialize game on load and when level changes
  useEffect(() => {
    initializeGame();
  }, [level, initializeGame]);

  // Clean up timer when component is unmounted
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4 animate-gradient">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2 animate-fade-in">
            🎵 Sound Memory Game 🎵
          </h1>
          <p className="text-gray-600 mb-6 text-lg animate-fade-in">
            Flip cards and find matching sound pairs!
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <Badge variant="outline" className="text-lg px-4 py-2 transform hover:scale-105 transition-transform badge-pulse">
              🎯 Level {level}
            </Badge>
            <Badge variant="outline" className="text-lg px-4 py-2 transform hover:scale-105 transition-transform">
              ⏱️ Time: {formatTime(time)}
            </Badge>
            <Badge variant="outline" className="text-lg px-4 py-2 transform hover:scale-105 transition-transform">
              🔄 Moves: {moves}
            </Badge>
            <Badge variant="outline" className="text-lg px-4 py-2 transform hover:scale-105 transition-transform">
              ✅ Pairs: {matchedPairs}/{getPairsCount(level)}
            </Badge>
            {bestScore !== null && (
              <Badge variant="outline" className="text-lg px-4 py-2 transform hover:scale-105 transition-transform bg-yellow-50 border-yellow-200">
                🏆 Best: {bestScore}
              </Badge>
            )}
          </div>
          
          {/* Progress bar */}
          <div className="w-full max-w-md mx-auto mb-6">
            <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-500 ease-out animate-glow"
                style={{ width: `${(matchedPairs / getPairsCount(level)) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Level progress: {Math.round((matchedPairs / getPairsCount(level)) * 100)}%
            </p>
          </div>
        </div>

        {gameComplete ? (
          <div className="text-center">
            <div className="bg-white rounded-lg shadow-lg p-8 mb-6 transform scale-100 transition-all duration-500 animate-bounce-in">
              <h2 className="text-3xl font-bold text-green-600 mb-4">🎉 Congratulations!</h2>
              <p className="text-gray-700 mb-4">
                You have completed all levels!
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
                  <p className="text-sm text-gray-600">Total Time</p>
                  <p className="text-2xl font-bold text-blue-600">{formatTime(time)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
                  <p className="text-sm text-gray-600">Total Moves</p>
                  <p className="text-2xl font-bold text-green-600">{moves}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
                  <p className="text-sm text-gray-600">Final Score</p>
                  <p className="text-2xl font-bold text-purple-600">{moves + time}</p>
                </div>
              </div>
              <Button 
                onClick={() => {
                  setLevel(1);
                  setGameComplete(false);
                  setBestScore(null);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-lg px-6 py-3 transform hover:scale-105 transition-transform"
              >
                🔄 Restart
              </Button>
            </div>
          </div>
        ) : gameOver ? (
          <div className="text-center">
            <div className="bg-white rounded-lg shadow-lg p-8 mb-6 transform scale-100 transition-all duration-500 animate-shake">
              <h2 className="text-3xl font-bold text-red-600 mb-4">💥 Game Over!</h2>
              <p className="text-gray-700 mb-4">
                A card was flipped 5 times without finding its pair...
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-red-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
                  <p className="text-sm text-gray-600">Level Reached</p>
                  <p className="text-2xl font-bold text-red-600">{level}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
                  <p className="text-sm text-gray-600">Time Elapsed</p>
                  <p className="text-2xl font-bold text-orange-600">{formatTime(time)}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
                  <p className="text-sm text-gray-600">Pairs Found</p>
                  <p className="text-2xl font-bold text-yellow-600">{matchedPairs}/{getPairsCount(level)}</p>
                </div>
              </div>
              <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800">
                  <strong>Rule:</strong> Each card can only be flipped 5 times maximum. 
                  Be strategic and memorize the sounds well!
                </p>
              </div>
              <Button 
                onClick={() => {
                  setLevel(1);
                  setGameOver(false);
                  setBestScore(null);
                }}
                className="bg-red-600 hover:bg-red-700 text-lg px-6 py-3 transform hover:scale-105 transition-transform"
              >
                🔄 Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className={`grid ${getGridSize()} gap-3 md:gap-4 mb-8`}>
            {cards.map((card) => (
              <Card
                key={card.id}
                className={`h-20 md:h-24 cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
                  card.isFlipped || card.isMatched
                    ? 'bg-gradient-to-br from-blue-100 to-blue-200 border-blue-300 shadow-lg'
                    : 'bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 shadow-md'
                } ${card.isMatched ? 'opacity-60' : ''} ${
                  isChecking && flippedCards.includes(card.id) ? 'ring-2 ring-yellow-400 animate-pulse' : ''
                } ${card.isMatched ? 'animate-success' : ''} ${
                  card.flipCount >= 4 ? 'animate-glow border-red-300' : ''
                } ${
                  card.flipCount === 5 ? 'bg-red-100 border-red-400' : ''
                }`}
                onClick={() => handleCardClick(card.id)}
              >
                <CardContent className="flex items-center justify-center h-full p-3">
                  {card.isFlipped || card.isMatched ? (
                    <div className="text-center animate-fade-in">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full mx-auto flex items-center justify-center ${
                        card.isMatched ? 'bg-green-500 animate-scale-in' : 'bg-blue-500 animate-pulse-once'
                      }`}>
                        <span className="text-white text-xl">
                          🎵
                        </span>
                      </div>
                      {/* Show flip counter */}
                      {!card.isMatched && (
                        <div className="mt-1">
                          <span className={`text-xs font-bold ${
                            card.flipCount >= 4 ? 'text-red-600 animate-pulse' : 'text-gray-600'
                          }`}>
                            {card.flipCount}/5
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full mx-auto flex items-center justify-center hover:from-gray-500 hover:to-gray-600 transition-colors">
                        <span className="text-white font-bold text-lg">?</span>
                      </div>
                      {/* Show counter even on unflipped cards */}
                      {card.flipCount > 0 && (
                        <div className="mt-1">
                          <span className={`text-xs font-bold ${
                            card.flipCount >= 4 ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {card.flipCount}/5
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-4">
          <Button
            onClick={initializeGame}
            variant="outline"
            className="px-6 py-2 transform hover:scale-105 transition-all duration-200 hover:shadow-lg"
          >
            🔄 Reset
          </Button>
          {level > 1 && (
            <Button
              onClick={() => setLevel(level - 1)}
              variant="outline"
              className="px-6 py-2 transform hover:scale-105 transition-all duration-200 hover:shadow-lg"
            >
              ⬅️ Previous Level
            </Button>
          )}
          {isPlaying && (
            <Button
              onClick={stopTimer}
              variant="outline"
              className="px-6 py-2 transform hover:scale-105 transition-all duration-200 hover:shadow-lg"
            >
              ⏸️ Pause
            </Button>
          )}
          {!isPlaying && time > 0 && (
            <Button
              onClick={startTimer}
              variant="outline"
              className="px-6 py-2 transform hover:scale-105 transition-all duration-200 hover:shadow-lg"
            >
              ▶️ Resume
            </Button>
          )}
        </div>

        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto transform hover:scale-102 transition-transform duration-300">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">How to Play?</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center justify-center gap-2">
                <span className="text-blue-500">🔊</span>
                Click cards to flip them and listen to the sounds
              </li>
              <li className="flex items-center justify-center gap-2">
                <span className="text-green-500">🎵</span>
                Rely only on your hearing to find identical sound pairs
              </li>
              <li className="flex items-center justify-center gap-2">
                <span className="text-purple-500">⬆️</span>
                Each completed level unlocks the next with more cards
              </li>
              <li className="flex items-center justify-center gap-2">
                <span className="text-orange-500">🏆</span>
                Try to complete with the fewest moves and fastest time!
              </li>
            </ul>
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-yellow-800">
                <strong>Tip:</strong> Cards show no visual information - 
                you must rely only on your auditory memory!
              </p>
            </div>
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-800">
                <strong>Warning:</strong> Each card can only be flipped 5 times maximum. 
                On the 5th flip without finding a pair, the game is lost!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  return <SoundMemoryGame />;
}