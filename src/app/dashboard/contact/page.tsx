"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card"
import { Badge } from "../../../components/ui/badge"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Textarea } from "../../../components/ui/textarea"
import { Label } from "../../../components/ui/label"
import { ConfirmationDialog } from "../../../components/ui/confirmation-dialog"
import { useToast } from "../../../hooks/use-toast"
import { useAuth } from "../../../context/AuthContext"
import { MessageSquare, Package, Send, RefreshCw, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"

export default function ContactPage() {
  const { butcher } = useAuth();
  const { toast } = useToast();
  
  // Contact form state
  const [contactMessage, setContactMessage] = useState('');
  const [packingRequests, setPackingRequests] = useState<{[size: string]: number}>({
    '0.5kg': 0,
    '1kg': 0,
    '1.5kg': 0,
    '2kg': 0
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [supportHistory, setSupportHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastSupportUpdate, setLastSupportUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  // Fetch support history when component mounts
  useEffect(() => {
    if (butcher?.id) {
      fetchSupportHistory();
    }
  }, [butcher?.id]);

  // Poll for support history updates every 30 seconds
  useEffect(() => {
    if (!butcher?.id || !pollingEnabled) return;

    const interval = setInterval(() => {
      fetchSupportHistory();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [butcher?.id, pollingEnabled]);

  // Contact form submission
  const handleContactSubmit = async () => {
    if (!butcher?.id) return;
    
    setIsSubmittingContact(true);
    try {
      const hasPackingRequest = Object.values(packingRequests).some(count => count > 0);
      
      if (!contactMessage.trim() && !hasPackingRequest) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please provide a message or select packing quantities.",
        });
        return;
      }

      const contactData = {
        butcherId: butcher.id,
        butcherName: butcher.name,
        message: contactMessage.trim(),
        packingRequests: hasPackingRequest ? packingRequests : null,
        timestamp: new Date().toISOString(),
        type: hasPackingRequest ? 'packing_request' : 'general_contact'
      };

      // Send to API endpoint
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit contact request');
      }
      
      toast({
        title: "Message Sent",
        description: "Your message has been sent to the admin. You'll receive a response soon.",
      });
      
      // Reset form
      setContactMessage('');
      setPackingRequests({
        '0.5kg': 0,
        '1kg': 0,
        '1.5kg': 0,
        '2kg': 0
      });
      
      // Refresh support history
      fetchSupportHistory();
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const fetchSupportHistory = async (isManualRefresh = false) => {
    if (!butcher) return;
    
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingHistory(true);
    }
    
    try {
      const response = await fetch(`/api/contact?butcherId=${butcher.id}`);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setSupportHistory(data.requests || []);
          setLastSupportUpdate(new Date());
          
          if (isManualRefresh) {
            toast({
              title: "Refreshed",
              description: "Support history has been updated.",
            });
          }
        } else {
          throw new Error('Invalid response format');
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch support history: ${response.status} ${errorText}`);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load support history.",
      });
    } finally {
      setIsLoadingHistory(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchSupportHistory(true);
  };

  const handleDeleteClick = (requestId: string) => {
    setRequestToDelete(requestId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!requestToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/contact?requestId=${requestToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Request Deleted",
          description: "Support request has been deleted successfully.",
        });
        
        // Immediately remove from local state for instant UI update
        setSupportHistory(prev => prev.filter(req => req.id !== requestToDelete));
        
        // Close the dialog
        setDeleteDialogOpen(false);
        setRequestToDelete(null);
        
        // Then refresh from server to ensure consistency
        setTimeout(() => {
          fetchSupportHistory();
        }, 500);
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete support request');
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Failed to delete support request: ${response.status} ${errorText}`);
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete support request. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!butcher) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">Contact Admin</h1>
          <p className="text-muted-foreground">Send messages to admin or request packing supplies</p>
          {lastSupportUpdate && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {lastSupportUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant={pollingEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setPollingEnabled(!pollingEnabled)}
            className="flex items-center gap-2"
          >
            {pollingEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6">
        {/* General Contact Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Send Message to Admin
            </CardTitle>
            <CardDescription>
              Contact the admin for any questions, issues, or general inquiries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                placeholder="Type your message here..."
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Packing Request Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Request Packing Supplies
            </CardTitle>
            <CardDescription>
              Request packing materials if you're running low on supplies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(packingRequests).map(([size, count]) => (
                <div key={size} className="space-y-2">
                  <Label htmlFor={`packing-${size}`}>{size} Bags</Label>
                  <Input
                    id={`packing-${size}`}
                    type="number"
                    min="0"
                    value={count}
                    onChange={(e) => setPackingRequests(prev => ({
                      ...prev,
                      [size]: parseInt(e.target.value) || 0
                    }))}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Submit Button */}
        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={handleContactSubmit}
              disabled={isSubmittingContact}
              className="w-full"
              size="lg"
            >
              {isSubmittingContact ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        
        {/* Support History */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Support History
                </CardTitle>
                <CardDescription>
                  View your previous messages and admin responses
                  <div className="flex items-center gap-4 mt-1">
                    {lastSupportUpdate && (
                      <span className="text-xs text-muted-foreground">
                        Last updated: {lastSupportUpdate.toLocaleTimeString()}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Auto-refresh: {pollingEnabled ? 'Every 30s' : 'Disabled'}
                    </span>
                  </div>
                </CardDescription>
              </div>
              <Button 
                onClick={handleManualRefresh} 
                disabled={isRefreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading support history...
              </div>
            ) : supportHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No support requests yet</p>
                <p className="text-sm">Send a message above to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {supportHistory.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Badge variant={request.status === 'resolved' ? 'default' : 'secondary'}>
                          {request.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(request.createdAt).toLocaleDateString()} at{' '}
                          {new Date(request.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {request.type === 'packing_request' ? 'Packing Request' : 'General Contact'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(request.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {request.message && (
                      <div>
                        <h4 className="font-medium mb-1">Your Message:</h4>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                          {request.message}
                        </p>
                      </div>
                    )}
                    
                    {request.packingRequests && (
                      <div>
                        <h4 className="font-medium mb-1">Packing Request:</h4>
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries(request.packingRequests).map(([size, count]) => {
                            const numCount = count as number;
                            return numCount > 0 && (
                              <Badge key={size} variant="outline">
                                {size}: {numCount} bags
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {request.adminResponse && (
                      <div className="border-t pt-3">
                        <h4 className="font-medium mb-1 text-green-600">Admin Response:</h4>
                        <p className="text-sm bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                          {request.adminResponse}
                        </p>
                        {request.updatedAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Responded on {new Date(request.updatedAt).toLocaleDateString()} at{' '}
                            {new Date(request.updatedAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Support Request"
        description="Are you sure you want to delete this support request? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  )
}
