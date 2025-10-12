import { useEffect, useState } from "react";
import styled from "@emotion/styled";
import { motion, AnimatePresence } from "framer-motion";
import { theme } from "./Theme";

type ErrorItem = {
  message: string;
  details: string;
};

type ErrorBoxProps = {
  header: string;
  errors: ErrorItem[];
  // If true, expand details for all errors by default on new errors
  startWithExpandedDetails?: boolean;
};

export const ErrorBox = ({ header, errors, startWithExpandedDetails = false }: ErrorBoxProps) => {
  const errorList = errors;

  const [isOpen, setIsOpen] = useState<boolean>(errorList.length > 0);
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    errorList.forEach((_, idx) => {
      initial[idx] = !!startWithExpandedDetails;
    });
    return initial;
  });

  // Auto-open when new errors arrive; reset expansions based on preference
  useEffect(() => {
    if (errorList.length > 0) {
      setIsOpen(true);
      setExpanded((prev) => {
        const next: Record<number, boolean> = {};
        errorList.forEach((_, idx) => {
          // Preserve previous state when possible, otherwise use default
          next[idx] = prev[idx] ?? !!startWithExpandedDetails;
        });
        return next;
      });
    }
  }, [errorList, startWithExpandedDetails]);

  const hasErrors = errorList.length > 0;

  return (
    <AnimatePresence>
      {hasErrors && (
        <Container
          initial={{ y: "100%", right: 16, bottom: 16 }}
          animate={{ y: 0, right: isOpen ? 16 : 0, bottom: isOpen ? 16 : 0, width: isOpen ? ERROR_BOX_WIDTH : "auto" }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.5 }}
          style={{ minWidth: isOpen ? 240 : 0 }}
        >
          <Header minimized={!isOpen} onClick={() => (!isOpen ? setIsOpen(true) : undefined)}>
            <Title>{header}</Title>
            <CloseButton
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen((v) => !v);
              }}
              aria-label={isOpen ? "Close error box" : "Open error box"}
              title={isOpen ? "Close" : "Open"}
            >
              {isOpen ? "×" : "▲"}
            </CloseButton>
          </Header>

          <AnimatePresence initial={false}>
            {isOpen && (
              <Content
                key="content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {errorList.map((err, idx) => {
                  const isExpanded = !!expanded[idx];
                  return (
                    <Item key={idx}>
                      <ItemHeader onClick={() => setExpanded((e) => ({ ...e, [idx]: !e[idx] }))}>
                        <Caret animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                          ▶
                        </Caret>
                        <Message title={err.message}>{err.message}</Message>
                      </ItemHeader>
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <Details
                            key="details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                          >
                            {err.details}
                          </Details>
                        )}
                      </AnimatePresence>
                    </Item>
                  );
                })}
              </Content>
            )}
          </AnimatePresence>
        </Container>
      )}
    </AnimatePresence>
  );
};

const ERROR_BOX_WIDTH = "min(30vw, 500px)";

const Container = styled(motion.div)`
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: ${ERROR_BOX_WIDTH};
  min-width: 240px;
  max-height: 40vh;
  background-color: ${theme.colors.blueishBlack};
  border: 2px solid ${theme.colors.orange};
  border-radius: 8px;
  box-shadow: 4px 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 1100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div<{ minimized: boolean }>`
  position: relative;
  padding: ${({ minimized }) => (minimized ? "10px 32px 10px 12px" : "12px 44px 12px 16px")};
  border-bottom: 1px solid ${theme.colors.grey};
  background-color: ${theme.colors.lessBlack};
  cursor: ${({ minimized }) => (minimized ? "pointer" : "default")};
`;

const Title = styled.h3`
  margin: 0;
  margin-right: 16px;
  color: ${theme.colors.orange};
  font-size: 18px;
  text-align: left;
  text-shadow: 0 0 4px ${theme.colors.orangeDark};
`;

const CloseButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border: 1px solid ${theme.colors.grey};
  border-radius: 4px;
  background-color: ${theme.colors.lessBlack};
  color: ${theme.colors.ultraWhite};
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  transition: all 0.2s ease;
  &:hover {
    background-color: ${theme.colors.greyDark};
    border-color: ${theme.colors.orange};
    color: ${theme.colors.orange};
  }
`;

// OpenIndicator removed in favor of a single toggle button using CloseButton styles

const Content = styled(motion.div)`
  margin-right: 2px;
  overflow-y: auto;
  padding: 8px 8px 12px 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${theme.colors.orange};
    border-radius: 3px;
  }
  &::-webkit-scrollbar-track {
    background-color: ${theme.colors.blueishBlack};
  }
`;

const Item = styled.div`
  border: 1px solid ${theme.colors.grey};
  border-radius: 6px;
  background-color: ${theme.colors.lessBlack};
  margin: 6px 0;
  overflow: hidden;
`;

const ItemHeader = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: transparent;
  color: ${theme.colors.ultraWhite};
  border: none;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.2s ease;
  &:hover {
    background-color: ${theme.colors.greyDark};
  }
`;

const Caret = styled(motion.span)`
  display: inline-block;
  width: 12px;
  text-align: center;
  color: ${theme.colors.orange};
`;

const Message = styled.span`
  flex: 1;
  font-size: 14px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Details = styled(motion.div)`
  padding: 10px 12px 12px 28px;
  color: ${theme.colors.white};
  background-color: ${theme.colors.blueishBlack};
  border-top: 1px solid ${theme.colors.grey};
  line-height: 1.4;
  white-space: pre-wrap;
`;
