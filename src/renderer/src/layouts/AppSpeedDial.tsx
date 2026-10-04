import React, { useState, useEffect } from 'react';
import {
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Badge,
  Box,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { ChatWidget } from '@/features/chat/ChatWidget';
import { AiAssistantWidget } from '@/features/ai-assistant/AiAssistantWidget';

export function AppSpeedDial(): React.JSX.Element | null {
  const { user } = useAuth();
  const { can } = useLicense();
  const location = useLocation();

  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // License gates
  const isAiActive = can('ai');
  const isChatActive = can('chat') && location.pathname !== '/chat';

  // Listen for global shortcut or link event to open AI Assistant
  useEffect(() => {
    function handleOpenAi() {
      if (can('ai')) {
        setAiOpen(true);
        setChatOpen(false);
        setSpeedDialOpen(false);
      }
    }
    window.addEventListener('careflow:open-ai-assistant', handleOpenAi);
    return () => window.removeEventListener('careflow:open-ai-assistant', handleOpenAi);
  }, [can]);

  // If neither AI nor Chat is licensed for this clinic, keep everything hidden
  if (!user || (!isAiActive && !isChatActive)) {
    return null;
  }

  const handleToggleAi = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setSpeedDialOpen(false);
    setAiOpen((prev) => {
      const next = !prev;
      if (next) setChatOpen(false);
      return next;
    });
  };

  const handleToggleChat = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setSpeedDialOpen(false);
    setChatOpen((prev) => {
      const next = !prev;
      if (next) setAiOpen(false);
      return next;
    });
  };

  const handleMainFabClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If either popup window is open, clicking the main button closes it
    if (aiOpen || chatOpen) {
      setAiOpen(false);
      setChatOpen(false);
      setSpeedDialOpen(false);
      return;
    }

    // If only one feature is active, clicking directly toggles that feature
    if (isAiActive && !isChatActive) {
      handleToggleAi(e);
      return;
    }
    if (isChatActive && !isAiActive) {
      handleToggleChat(e);
      return;
    }

    // If both are active, toggle the SpeedDial menu
    setSpeedDialOpen((prev) => !prev);
  };

  const anyPopupOpen = aiOpen || chatOpen;

  return (
    <>
      {/* Staff Chat Drawer/Window */}
      {isChatActive && (
        <ChatWidget
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          hideFab
          onUnreadChange={setUnreadChatCount}
        />
      )}

      {/* AI Assistant Drawer/Window - only rendered if active on license key */}
      {isAiActive && (
        <AiAssistantWidget
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          hideFab
        />
      )}

      {/* Unified SpeedDial Floating Action */}
      <Box sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1400 }}>
        <SpeedDial
          ariaLabel="Quick Assistants SpeedDial"
          icon={
            anyPopupOpen ? (
              <CloseIcon />
            ) : (
              <Badge
                badgeContent={unreadChatCount}
                color="error"
                max={9}
                sx={{
                  '& .MuiBadge-badge': {
                    fontWeight: 700,
                    fontSize: 11,
                    border: '2px solid #ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  },
                }}
              >
                <SpeedDialIcon
                  icon={<SmartToyIcon sx={{ fontSize: 26 }} />}
                  openIcon={<CloseIcon />}
                />
              </Badge>
            )
          }
          onClose={(_e, reason) => {
            if (reason !== 'toggle') {
              setSpeedDialOpen(false);
            }
          }}
          onOpen={() => {
            if (!anyPopupOpen) {
              setSpeedDialOpen(true);
            }
          }}
          open={speedDialOpen && !anyPopupOpen}
          direction="up"
          sx={{
            // Keep tooltip label on one single line, no text wrapping
            '& .MuiSpeedDialAction-staticTooltipLabel': {
              whiteSpace: 'nowrap !important',
              fontWeight: 600,
              fontSize: '0.82rem',
              lineHeight: 1.2,
              px: 1.5,
              py: 0.75,
              borderRadius: '8px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
              color: 'text.primary',
              bgcolor: 'background.paper',
            },
          }}
          FabProps={{
            onClick: handleMainFabClick,
            sx: {
              background: aiOpen
                ? 'linear-gradient(135deg, #059669 0%, #0d9488 100%)'
                : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
              boxShadow: '0 8px 26px rgba(5, 150, 105, 0.4)',
              transition: 'all 0.25s ease',
              '&:hover': {
                background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
                transform: 'scale(1.05)',
              },
            },
          }}
        >
          {/* AI Assistant Option: Only present when active on license key */}
          {isAiActive && (
            <SpeedDialAction
              key="ai-assistant"
              icon={<AutoAwesomeIcon sx={{ color: '#059669' }} />}
              tooltipTitle="CareFlow AI Assistant"
              tooltipOpen
              onClick={(e) => handleToggleAi(e)}
              FabProps={{
                onClick: (e) => handleToggleAi(e),
                sx: {
                  bgcolor: 'background.paper',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                },
              }}
            />
          )}

          {/* Staff Chat Option: Only present when chat is licensed & not on /chat */}
          {isChatActive && (
            <SpeedDialAction
              key="staff-chat"
              icon={
                <Badge badgeContent={unreadChatCount} color="error" max={9}>
                  <ChatOutlinedIcon color="primary" />
                </Badge>
              }
              tooltipTitle="Staff Chat"
              tooltipOpen
              onClick={(e) => handleToggleChat(e)}
              FabProps={{
                onClick: (e) => handleToggleChat(e),
                sx: {
                  bgcolor: 'background.paper',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                },
              }}
            />
          )}
        </SpeedDial>
      </Box>
    </>
  );
}
