import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// ============================================================
// 🎨 Colors
// ============================================================
const COLORS = {
  primary: "#22c55e",
  primaryDark: "#16a34a",
  primaryLight: "#86efac",
  background: "#0a0f0d",
  cardBackground: "#1a1f1d",
  cardHover: "#1f2623",
  border: "#2d3330",
  text: "#ffffff",
  textSecondary: "#9ca3af",
  textTertiary: "#6b7280",
  success: "#22c55e",
  error: "#ef4444",
};

const { width } = Dimensions.get("window");
const CONVERSATION_PANEL_WIDTH = width * 0.45;

// ============================================================
// 📝 Types
// ============================================================
interface Message {
  id: string;
  content: string;
  senderId: string;
  chatId: string;
  createdAt: string;
  isSelf?: boolean;
}

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread?: number;
  avatar: string;
  product?: string;
  isOnline?: boolean;
}

// ============================================================
// 🎨 Mock Data
// ============================================================
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "chat-1",
    name: "Farmer John",
    lastMessage: "Yes, the rice straw is still available!",
    time: "5m ago",
    avatar: "FJ",
    product: "Rice Straw - 500kg",
    unread: 2,
    isOnline: true,
  },
  {
    id: "chat-2",
    name: "Ramesh Kumar",
    lastMessage: "Can we discuss the price?",
    time: "30m ago",
    avatar: "RK",
    product: "Wheat Chaff - 300kg",
    isOnline: true,
  },
  {
    id: "chat-3",
    name: "Priya Singh",
    lastMessage: "Thank you for the information!",
    time: "2h ago",
    avatar: "PS",
    product: "Corn Stalks - 400kg",
    isOnline: false,
  },
  {
    id: "chat-4",
    name: "Vijay Patel",
    lastMessage: "When can I pick it up?",
    time: "5h ago",
    avatar: "VP",
    product: "Cotton Residue - 200kg",
    isOnline: true,
  },
];

const MOCK_MESSAGES: Message[] = [
  {
    id: "msg-1",
    content: "Hi! I'm interested in your Rice Straw listing.",
    senderId: "user-123",
    chatId: "chat-1",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    isSelf: true,
  },
  {
    id: "msg-2",
    content: "Hello! Yes, it's available. Would you like more details?",
    senderId: "farmer-john",
    chatId: "chat-1",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    isSelf: false,
  },
];

// ============================================================
// 🎨 Main Chat Component
// ============================================================
export default function ChatsScreen() {
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(
    MOCK_CONVERSATIONS[0]
  );
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const CURRENT_USER_ID = "user-123";

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !selectedChat) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      content: inputText.trim(),
      senderId: CURRENT_USER_ID,
      chatId: selectedChat.id,
      createdAt: new Date().toISOString(),
      isSelf: true,
    };

    setMessages([...messages, newMessage]);
    setInputText("");
  };

  const filteredConversations = MOCK_CONVERSATIONS.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================================
  // 🎨 Render Conversation Item
  // ============================================================
  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const isSelected = selectedChat?.id === item.id;

    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedChat(item);
          if (item.id === "chat-1") {
            setMessages(MOCK_MESSAGES);
          } else {
            setMessages([]);
          }
        }}
        style={[
          styles.conversationItem,
          isSelected && styles.conversationItemSelected,
        ]}
        activeOpacity={0.7}
      >
        {/* Avatar with Online Status */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.avatar}</Text>
          </View>
          {item.isOnline && <View style={styles.onlineIndicator} />}
        </View>

        {/* Content */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.conversationTime}>{item.time}</Text>
          </View>
          {item.product && (
            <Text style={styles.productText} numberOfLines={1}>
              {item.product}
            </Text>
          )}
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>

        {/* Unread Badge */}
        {item.unread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ============================================================
  // 🎨 Render Message Item
  // ============================================================
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isSelf = item.isSelf;
    const time = new Date(item.createdAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return (
      <View
        style={[
          styles.messageContainer,
          isSelf ? styles.messageContainerSelf : styles.messageContainerOther,
        ]}
      >
        {/* Avatar for other users */}
        {!isSelf && (
          <View style={styles.messageAvatar}>
            <Text style={styles.messageAvatarText}>
              {selectedChat?.avatar || "?"}
            </Text>
          </View>
        )}

        {/* Message Bubble */}
        <View
          style={[
            styles.messageBubble,
            isSelf ? styles.messageBubbleSelf : styles.messageBubbleOther,
          ]}
        >
          <Text style={styles.messageText}>{item.content}</Text>
          <Text style={[styles.messageTime, isSelf && styles.messageTimeSelf]}>
            {time}
          </Text>
        </View>
      </View>
    );
  };

  // ============================================================
  // 🎨 Main Render
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.mainContainer}>
        {/* ============================================================ */}
        {/* 📱 Left Panel - Conversation List */}
        {/* ============================================================ */}
        <View style={styles.conversationPanel}>
          {/* Header */}
          <View style={styles.leftHeader}>
            <View style={styles.appHeader}>
              <View style={styles.appIconContainer}>
                <Ionicons name="chatbubbles" size={24} color={COLORS.text} />
              </View>
              <View style={styles.appInfo}>
                <Text style={styles.appTitle}>AgriLink</Text>
                <Text style={styles.appSubtitle}>
                  Smart Crop Health & Resource Management
                </Text>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={18}
                color={COLORS.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                placeholder="Search conversations..."
                placeholderTextColor={COLORS.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
              />
            </View>
          </View>

          {/* Conversations List */}
          <FlatList
            data={filteredConversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.conversationsList}
          />
        </View>

        {/* ============================================================ */}
        {/* 💬 Right Panel - Chat Messages */}
        {/* ============================================================ */}
        {!selectedChat ? (
          <View style={styles.emptyChat}>
            <Ionicons
              name="chatbubbles-outline"
              size={80}
              color={COLORS.primary}
            />
            <Text style={styles.emptyChatText}>
              Select a conversation to start chatting
            </Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.chatPanel}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          >
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                <View style={styles.chatHeaderAvatar}>
                  <Text style={styles.chatHeaderAvatarText}>
                    {selectedChat.avatar}
                  </Text>
                </View>
                <View style={styles.chatHeaderInfo}>
                  <Text style={styles.chatHeaderName}>{selectedChat.name}</Text>
                  {selectedChat.product && (
                    <Text style={styles.chatHeaderProduct}>
                      {selectedChat.product}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity style={styles.moreButton}>
                <Ionicons
                  name="ellipsis-vertical"
                  size={24}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyMessages}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={48}
                    color={COLORS.textTertiary}
                  />
                  <Text style={styles.emptyMessagesText}>No messages yet</Text>
                  <Text style={styles.emptyMessagesSubtext}>
                    Start the conversation!
                  </Text>
                </View>
              }
            />

            {/* Message Input */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  placeholder="Type a message..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSendMessage}
                  returnKeyType="send"
                  multiline
                  maxLength={500}
                  style={styles.textInput}
                />
              </View>
              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={!inputText.trim()}
                style={[
                  styles.sendButton,
                  !inputText.trim() && styles.sendButtonDisabled,
                ]}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={inputText.trim() ? COLORS.text : COLORS.textTertiary}
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// 🎨 Styles
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainContainer: {
    flex: 1,
    flexDirection: "row",
  },
  // Left Panel
  conversationPanel: {
    width: CONVERSATION_PANEL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  leftHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  appIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  appInfo: {
    flex: 1,
  },
  appTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  appSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  conversationsList: {
    paddingVertical: 4,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 2,
    borderLeftColor: "transparent",
  },
  conversationItemSelected: {
    backgroundColor: COLORS.cardHover,
    borderLeftColor: COLORS.primary,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 16,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  conversationContent: {
    flex: 1,
    gap: 2,
  },
  conversationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  conversationName: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: 15,
    flex: 1,
  },
  conversationTime: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginLeft: 8,
  },
  productText: {
    color: COLORS.primary,
    fontSize: 12,
  },
  lastMessage: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },
  // Chat Panel
  chatPanel: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyChatText: {
    color: COLORS.textSecondary,
    fontSize: 18,
    marginTop: 16,
    textAlign: "center",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  chatHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  chatHeaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  chatHeaderAvatarText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 16,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: 18,
  },
  chatHeaderProduct: {
    color: COLORS.primary,
    fontSize: 13,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Messages
  messagesList: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 16,
    maxWidth: "80%",
  },
  messageContainerSelf: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  messageContainerOther: {
    alignSelf: "flex-start",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  messageAvatarText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 12,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: "85%",
  },
  messageBubbleSelf: {
    backgroundColor: COLORS.primaryDark,
    borderTopRightRadius: 4,
    marginLeft: 8,
  },
  messageBubbleOther: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 4,
  },
  messageText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  messageTime: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  messageTimeSelf: {
    color: COLORS.primaryLight,
  },
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyMessagesText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 12,
    fontWeight: "600",
  },
  emptyMessagesSubtext: {
    color: COLORS.textTertiary,
    fontSize: 14,
    marginTop: 4,
  },
  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  textInput: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.cardBackground,
  },
});
